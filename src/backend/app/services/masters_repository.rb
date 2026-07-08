# frozen_string_literal: true

# マスタ(DB シード済み 61件)への型付きアクセサ。
# ドメイン層はここ経由でマスタ(プレーンな Hash 配列)を受け取り、DB と一貫させる。
# 移植元: src/lib/masters.ts。
class MastersRepository
  OTHER_CATEGORY_KEY = "other"

  def categories
    @categories ||= Category.order(:id).map { |c| { id: c.id, key: c.key, name: c.name } }
  end

  def category_keywords
    @category_keywords ||=
      CategoryKeyword.order(:id).map { |k| { id: k.id, category_id: k.category_id, keyword: k.keyword } }
  end

  def date_patterns
    @date_patterns ||=
      DatePatternMaster.order(:id).map do |p|
        { id: p.id, label: p.label, regex: p.regex, priority: p.priority, kind: p.kind }
      end
  end

  def alert_levels
    @alert_levels ||=
      AlertLevelMaster.order(:id).map do |l|
        { id: l.id, key: l.key, name: l.name, min_days: l.min_days, led_color: l.led_color }
      end
  end

  def esp32_commands
    @esp32_commands ||=
      Esp32CommandMaster.order(:id).map do |c|
        { id: c.id, level_key: c.level_key, command: c.command, fan_seconds: c.fan_seconds }
      end
  end

  def other_category_id
    @other_category_id ||=
      begin
        row = categories.find { |c| c[:key] == OTHER_CATEGORY_KEY }
        row ? row[:id] : categories.last[:id]
      end
  end

  def category_name(id)
    row = categories.find { |c| c[:id] == id }
    row ? row[:name] : ""
  end

  # 採用不可時のカテゴリ別デフォルト期限日数。存在しなければ例外(フォールバック禁止)。
  def default_days_for(category_id)
    row = DefaultExpiryMaster.find_by(category_id: category_id)
    raise "default_expiry_master にカテゴリ #{category_id} が存在しません" unless row

    row.default_days
  end

  # カテゴリ別日次消費率。存在しなければ例外(フォールバック禁止)。
  def consumption_rate_for(category_id)
    row = ConsumptionRateMaster.find_by(category_id: category_id)
    raise "consumption_rate_master にカテゴリ #{category_id} が存在しません" unless row

    row.percent_per_day
  end
end
