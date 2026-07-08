# frozen_string_literal: true

require "net/http"
require "json"

# ESP32 デバイス接続の環境分岐。
#  - virtual(既定): 画面デモ用の仮想デバイス。コマンドを受理し状態を保持する。
#  - http:          実 ESP32 へ HTTP 送信(AppConfig.esp32[:baseUrl])。
#  - off:           デバイス無し。常に失敗させ「デバイス未接続」を再現する。
# 環境変数 FW_ESP32_MODE で切替(未設定は virtual)。
# 移植元: src/lib/device.ts。
module Device
  # 画面デモ用の仮想デバイス。transport は call(command, fan_seconds) -> true。
  class VirtualDevice
    def initialize
      @state = { command: "LED_OFF", fan_seconds: 0, updated_at: nil }
    end

    def transport
      ->(command, fan_seconds) do
        @state = { command: command, fan_seconds: fan_seconds, updated_at: Time.now.utc.iso8601(3) }
        true
      end
    end

    def snapshot
      @state.dup
    end
  end

  # 実 ESP32 への HTTP transport。POST {base}/command。ACK(2xx)で true。
  def self.http_transport(base_url, timeout_ms)
    ->(command, fan_seconds) do
      uri = URI.join("#{base_url}/", "command")
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == "https")
      http.open_timeout = timeout_ms / 1000.0
      http.read_timeout = timeout_ms / 1000.0
      req = Net::HTTP::Post.new(uri)
      req["Content-Type"] = "application/json"
      req.body = JSON.generate(command: command, fan_seconds: fan_seconds)
      res = http.request(req)
      res.is_a?(Net::HTTPSuccess)
    end
  end

  Binding = Struct.new(:mode, :transport, :virtual, keyword_init: true)

  def self.resolve_mode(env)
    raw = (env["FW_ESP32_MODE"] || "virtual").downcase
    %w[http off].include?(raw) ? raw : "virtual"
  end

  # 環境に応じた transport を組み立てる。virtual のときのみ状態参照用インスタンスを返す。
  def self.bind(env)
    mode = resolve_mode(env)
    case mode
    when "http"
      Binding.new(mode: mode, transport: http_transport(AppConfig.esp32[:baseUrl], AppConfig.esp32[:timeoutMs]), virtual: nil)
    when "off"
      Binding.new(mode: mode, transport: ->(_command, _fan_seconds) { false }, virtual: nil)
    else
      virtual = VirtualDevice.new
      Binding.new(mode: mode, transport: virtual.transport, virtual: virtual)
    end
  end
end
