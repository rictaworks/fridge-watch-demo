# frozen_string_literal: true

# 冷蔵庫管理デモ版 全スキーマ(設計 §2 ER図に準拠)。
# マスタ = 恒久データ(日次リセットで保持)、トランザクション = 日次リセット対象。
# 認証なし・セッションID所有分離(全トランザクションに session_id を必須オーナーキーとして保持)。
class CreateSchema < ActiveRecord::Migration[8.1]
  def change
    # ===== マスタ(日次リセットで保持) =====
    create_table :categories, id: :integer do |t|
      t.string :key, null: false
      t.string :name, null: false
    end
    add_index :categories, :key, unique: true

    create_table :default_expiry_master, primary_key: :category_id, id: :integer do |t|
      t.integer :default_days, null: false
    end

    create_table :consumption_rate_master, primary_key: :category_id, id: :integer do |t|
      t.integer :percent_per_day, null: false
    end

    create_table :date_pattern_master, id: :integer do |t|
      t.string :label, null: false
      t.string :regex, null: false
      t.integer :priority, null: false
      t.string :kind, null: false
    end

    create_table :category_keywords, id: :integer do |t|
      t.integer :category_id, null: false
      t.string :keyword, null: false
    end

    create_table :alert_level_master, id: :integer do |t|
      t.string :key, null: false
      t.string :name, null: false
      t.integer :min_days, null: false
      t.string :led_color, null: false
    end
    add_index :alert_level_master, :key, unique: true

    create_table :esp32_command_master, id: :integer do |t|
      t.string :level_key, null: false
      t.string :command, null: false
      t.integer :fan_seconds, null: false
    end

    # ===== トランザクション(日次リセットで全削除) =====
    create_table :sessions, primary_key: :session_id, id: :string do |t|
      t.string :created_at, null: false
      t.string :last_accessed_at, null: false
    end

    create_table :food_items do |t|
      t.string :session_id, null: false
      t.integer :category_id, null: false
      t.string :name
      t.string :expiry_date, null: false
      t.integer :is_estimated, null: false, default: 0
      t.string :registered_at, null: false
    end
    add_index :food_items, :session_id

    create_table :remain_adjustments do |t|
      t.integer :food_item_id, null: false
      t.string :session_id, null: false
      t.integer :adjusted_percent, null: false
      t.string :adjusted_at, null: false
    end
    add_index :remain_adjustments, :food_item_id

    create_table :alert_logs do |t|
      t.string :session_id, null: false
      t.integer :level_id, null: false
      t.string :fired_at, null: false
      t.integer :fan_activated, null: false, default: 0
    end
    add_index :alert_logs, :session_id
  end
end
