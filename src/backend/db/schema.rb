# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_07_07_000001) do
  create_table "alert_level_master", force: :cascade do |t|
    t.string "key", null: false
    t.string "led_color", null: false
    t.integer "min_days", null: false
    t.string "name", null: false
    t.index ["key"], name: "index_alert_level_master_on_key", unique: true
  end

  create_table "alert_logs", force: :cascade do |t|
    t.integer "fan_activated", default: 0, null: false
    t.string "fired_at", null: false
    t.integer "level_id", null: false
    t.string "session_id", null: false
    t.index ["session_id"], name: "index_alert_logs_on_session_id"
  end

  create_table "categories", force: :cascade do |t|
    t.string "key", null: false
    t.string "name", null: false
    t.index ["key"], name: "index_categories_on_key", unique: true
  end

  create_table "category_keywords", force: :cascade do |t|
    t.integer "category_id", null: false
    t.string "keyword", null: false
  end

  create_table "consumption_rate_master", primary_key: "category_id", force: :cascade do |t|
    t.integer "percent_per_day", null: false
  end

  create_table "date_pattern_master", force: :cascade do |t|
    t.string "kind", null: false
    t.string "label", null: false
    t.integer "priority", null: false
    t.string "regex", null: false
  end

  create_table "default_expiry_master", primary_key: "category_id", force: :cascade do |t|
    t.integer "default_days", null: false
  end

  create_table "esp32_command_master", force: :cascade do |t|
    t.string "command", null: false
    t.integer "fan_seconds", null: false
    t.string "level_key", null: false
  end

  create_table "food_items", force: :cascade do |t|
    t.integer "category_id", null: false
    t.string "expiry_date", null: false
    t.integer "is_estimated", default: 0, null: false
    t.string "name"
    t.string "registered_at", null: false
    t.string "session_id", null: false
    t.index ["session_id"], name: "index_food_items_on_session_id"
  end

  create_table "remain_adjustments", force: :cascade do |t|
    t.string "adjusted_at", null: false
    t.integer "adjusted_percent", null: false
    t.integer "food_item_id", null: false
    t.string "session_id", null: false
    t.index ["food_item_id"], name: "index_remain_adjustments_on_food_item_id"
  end

  create_table "sessions", primary_key: "session_id", id: :string, force: :cascade do |t|
    t.string "created_at", null: false
    t.string "last_accessed_at", null: false
  end
end
