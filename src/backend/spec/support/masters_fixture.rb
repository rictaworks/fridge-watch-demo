# frozen_string_literal: true

# ドメイン単体テスト用に config/masters.json を symbol キーで読み込むヘルパー。
# 実データ(正規表現・レベル閾値)を DB 非依存で使えるようにする。
module MastersFixture
  module_function

  def raw
    @raw ||= JSON.parse(File.read(Rails.root.join("config", "masters.json"))).deep_symbolize_keys
  end

  def date_patterns
    raw[:date_patterns].map { |p| p.transform_keys(&:to_sym) }
  end

  def category_keywords
    raw[:category_keywords]
  end

  def alert_levels
    raw[:alert_levels]
  end

  def esp32_commands
    raw[:esp32_commands]
  end

  def other_category_id
    raw[:categories].find { |c| c[:key] == "other" }[:id]
  end
end
