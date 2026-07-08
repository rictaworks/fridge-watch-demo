# frozen_string_literal: true

# サービス層。F1(登録)・F2(残量)・F3(アラート/ESP32)を束ねる。
# すべてセッションIDスコープで動作し、他セッションのデータには一切触れない。
# 移植元: src/lib/service.ts。
class FridgeService
  # transport: call(command, fan_seconds) -> true/false(ESP32 送信)。
  def initialize(transport:, masters: MastersRepository.new, repo: FoodRepo.new)
    @transport = transport
    @masters = masters
    @repo = repo
  end

  # F1: OCR テキストから登録。ocr_text が空(完全失敗)、または日付が一つも抽出できない場合は
  # needManual を返し登録しない(カテゴリ別デフォルトへのフォールバックは行わない)。
  def register_from_ocr(session_id, name:, ocr_text:, now:)
    text = ocr_text.to_s.strip
    return { needManual: true } if text.empty?

    category_id = CategoryClassifier.classify(text, @masters.category_keywords, @masters.other_category_id)
    expiry = ExpiryResolver.resolve(text, patterns: @masters.date_patterns, now: now)
    return { needManual: true } if expiry.nil?

    @repo.insert_item(
      session_id: session_id,
      category_id: category_id,
      name: name || text[0, 40],
      expiry_date: expiry.expiry_date,
      is_estimated: expiry.is_estimated,
      registered_at: JstTime.iso8601(now),
    )
    notify_and_view(session_id, now)
  end

  # F1(手動フォールバック): カテゴリと期限を直接指定して登録。
  def register_manual(session_id, name:, category_id:, expiry_date:, now:)
    @repo.insert_item(
      session_id: session_id,
      category_id: category_id,
      name: name,
      expiry_date: expiry_date,
      is_estimated: false,
      registered_at: JstTime.iso8601(now),
    )
    notify_and_view(session_id, now)
  end

  # F2: 残量手動補正。所有者不一致は nil。
  def adjust(session_id, item_id, percent, now)
    item = @repo.get_item(session_id, item_id)
    return nil unless item

    @repo.insert_adjustment(session_id, item_id, RemainEstimator.clamp_percent(percent), JstTime.iso8601(now))
    notify_and_view(session_id, now)
  end

  # 食材削除。所有者不一致は nil。
  def remove(session_id, item_id, now)
    ok = @repo.delete_item(session_id, item_id)
    return nil unless ok

    notify_and_view(session_id, now)
  end

  # 一覧取得(残量・アラート込み)。ESP32 へも現在レベルを反映する。
  def view(session_id, now)
    notify_and_view(session_id, now)
  end

  # 手動リセット: 自セッションのデータのみ削除し、消灯まで反映する。
  def clear_own(session_id, now)
    deleted = @repo.clear_session(session_id)
    view = notify_and_view(session_id, now)
    { view: view, deleted: deleted }
  end

  private

  def compute_item_state(item, now)
    rate = @masters.consumption_rate_for(item.category_id)
    adj = @repo.latest_adjustment(item.session_id, item.id)
    base_percent = adj ? adj[:adjusted_percent] : AppConfig.remain[:initialPercent]
    base_at = Time.iso8601(adj ? adj[:adjusted_at] : item.registered_at)
    remain = RemainEstimator.estimate(base_percent: base_percent, base_at: base_at, rate_per_day: rate, now: now)
    remaining_days = JstTime.diff_days_iso(JstTime.jst_today_iso(now), item.expiry_date)
    {
      id: item.id,
      name: item.name,
      categoryId: item.category_id,
      categoryName: @masters.category_name(item.category_id),
      expiryDate: item.expiry_date,
      isEstimated: item.is_estimated == 1,
      remainingDays: remaining_days,
      remainPercent: remain.percent,
      restock: remain.restock,
    }
  end

  # F3: アラート判定 → ESP32 送信 → ログ記録。そのうえで一覧ビューを返す。
  def notify_and_view(session_id, now)
    items = @repo.list_items(session_id).map { |i| compute_item_state(i, now) }
    decision = AlertEvaluator.evaluate(
      items.map { |i| i[:expiryDate] },
      now,
      levels: @masters.alert_levels,
      commands: @masters.esp32_commands,
    )
    alert = dispatch_device(session_id, decision, now)
    { items: items, alert: alert }
  end

  def dispatch_device(session_id, decision, now)
    last_fan_at = @repo.last_fan_at(session_id)
    result = Esp32Controller.send(decision, now: now, last_fan_at: last_fan_at, transport: @transport)

    # 送信可否に関わらず、危険レベル発火は履歴に残す(fan_activated は実結果)。
    if decision.level_key != "off" && !decision.level_id.nil?
      @repo.insert_alert_log(session_id, decision.level_id, JstTime.iso8601(now), result.fan_activated)
    end

    {
      levelKey: decision.level_key,
      ledColor: decision.led_color,
      command: decision.command,
      fanActivated: result.fan_activated,
      deviceConnected: result.device_connected,
      minDays: decision.min_days,
    }
  end
end
