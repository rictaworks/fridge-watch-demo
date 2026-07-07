# frozen_string_literal: true

# データアクセス層。全クエリでセッションIDによる所有スコープを強制する。
# セッションを跨いだ参照・更新・削除は原理的に不可能な形にする。
# 移植元: src/lib/repo.ts。
class FoodRepo
  # 食材を登録し、採番された id を返す。
  def insert_item(session_id:, category_id:, name:, expiry_date:, is_estimated:, registered_at:)
    item = FoodItem.create!(
      session_id: session_id,
      category_id: category_id,
      name: name,
      expiry_date: expiry_date,
      is_estimated: is_estimated ? 1 : 0,
      registered_at: registered_at,
    )
    item.id
  end

  # 自セッションの食材のみを返す(期限昇順)。
  def list_items(session_id)
    FoodItem.where(session_id: session_id).order(Arel.sql("expiry_date ASC, id ASC")).to_a
  end

  # 自セッションかつ指定IDの食材を返す(他セッションは nil)。
  def get_item(session_id, id)
    FoodItem.find_by(id: id, session_id: session_id)
  end

  # 自セッションの食材を削除する(所有者不一致なら false)。補正履歴も併せて削除。
  def delete_item(session_id, id)
    ActiveRecord::Base.transaction do
      RemainAdjustment.where(food_item_id: id, session_id: session_id).delete_all
      changes = FoodItem.where(id: id, session_id: session_id).delete_all
      changes.positive?
    end
  end

  # 補正を記録する(所有者チェック済み前提)。
  def insert_adjustment(session_id, food_item_id, percent, at)
    RemainAdjustment.create!(
      food_item_id: food_item_id,
      session_id: session_id,
      adjusted_percent: percent,
      adjusted_at: at,
    )
  end

  # 食材の直近補正(値・時刻)を返す。無ければ nil。
  def latest_adjustment(session_id, food_item_id)
    RemainAdjustment
      .where(food_item_id: food_item_id, session_id: session_id)
      .order(Arel.sql("adjusted_at DESC, id DESC"))
      .limit(1)
      .pick(:adjusted_percent, :adjusted_at)
      &.then { |percent, at| { adjusted_percent: percent, adjusted_at: at } }
  end

  # アラート発火を記録する。
  def insert_alert_log(session_id, level_id, fired_at, fan_activated)
    AlertLog.create!(
      session_id: session_id,
      level_id: level_id,
      fired_at: fired_at,
      fan_activated: fan_activated ? 1 : 0,
    )
  end

  # 自セッションのトランザクションデータのみを削除する(手動リセット用)。
  # 全セッションを消す全体リセット(F4)とは別物で、他人のデータには触れない。
  def clear_session(session_id)
    ActiveRecord::Base.transaction do
      adj = RemainAdjustment.where(session_id: session_id).delete_all
      items = FoodItem.where(session_id: session_id).delete_all
      alerts = AlertLog.where(session_id: session_id).delete_all
      { food_items: items, remain_adjustments: adj, alert_logs: alerts }
    end
  end

  # 直近にファンを作動させた時刻(クールダウン判定用)。無ければ nil。
  def last_fan_at(session_id)
    at = AlertLog
      .where(session_id: session_id, fan_activated: 1)
      .order(Arel.sql("fired_at DESC, id DESC"))
      .limit(1)
      .pick(:fired_at)
    at ? Time.iso8601(at) : nil
  end
end
