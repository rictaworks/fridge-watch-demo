# frozen_string_literal: true

# マスタ 61件を config/masters.json から投入する(§1.7)。
# categories 8 / default_expiry 8 / consumption_rate 8 / date_patterns 6 /
# category_keywords 24 / alert_levels 3 / esp32_commands 4 = 61 件。
# 冪等: upsert で再実行しても重複しない。マスタは日次リセットで保持される恒久データ。

masters = JSON.parse(File.read(Rails.root.join("config", "masters.json")))

ActiveRecord::Base.transaction do
  masters.fetch("categories").each do |c|
    Category.upsert({ id: c["id"], key: c["key"], name: c["name"] }, unique_by: :id)
  end

  masters.fetch("default_expiry").each do |d|
    DefaultExpiryMaster.upsert(
      { category_id: d["category_id"], default_days: d["default_days"] }, unique_by: :category_id
    )
  end

  masters.fetch("consumption_rate").each do |r|
    ConsumptionRateMaster.upsert(
      { category_id: r["category_id"], percent_per_day: r["percent_per_day"] }, unique_by: :category_id
    )
  end

  masters.fetch("date_patterns").each do |p|
    DatePatternMaster.upsert(
      { id: p["id"], label: p["label"], regex: p["regex"], priority: p["priority"], kind: p["kind"] },
      unique_by: :id,
    )
  end

  masters.fetch("category_keywords").each do |k|
    CategoryKeyword.upsert(
      { id: k["id"], category_id: k["category_id"], keyword: k["keyword"] }, unique_by: :id
    )
  end

  masters.fetch("alert_levels").each do |l|
    AlertLevelMaster.upsert(
      { id: l["id"], key: l["key"], name: l["name"], min_days: l["min_days"], led_color: l["led_color"] },
      unique_by: :id,
    )
  end

  masters.fetch("esp32_commands").each do |e|
    Esp32CommandMaster.upsert(
      { id: e["id"], level_key: e["level_key"], command: e["command"], fan_seconds: e["fan_seconds"] },
      unique_by: :id,
    )
  end
end

total = Category.count + DefaultExpiryMaster.count + ConsumptionRateMaster.count +
        DatePatternMaster.count + CategoryKeyword.count + AlertLevelMaster.count +
        Esp32CommandMaster.count
Rails.logger.info({ event: "seed_masters", total: total }.to_json)
puts "マスタ投入完了: 合計 #{total} 件"
