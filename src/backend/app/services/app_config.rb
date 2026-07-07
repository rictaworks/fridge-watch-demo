# frozen_string_literal: true

# 設定値(閾値・セッション・ESP32・リセット・i18n)を config/app.json から読み込む。
# ハードコード禁止のため文字列リテラル/しきい値はここに集約する(移植元 config/app.json 準拠)。
module AppConfig
  PATH = Rails.root.join("config", "app.json")

  class << self
    def data
      @data ||= JSON.parse(File.read(PATH)).deep_symbolize_keys.freeze
    end

    def session = data[:session]
    def upload = data[:upload]
    def expiry = data[:expiry]
    def remain = data[:remain]
    def alert = data[:alert]
    def esp32 = data[:esp32]
    def reset = data[:reset]
    def i18n = data[:i18n]

    # テスト等での再読込用(通常は不要)。
    def reload!
      @data = nil
      data
    end
  end
end
