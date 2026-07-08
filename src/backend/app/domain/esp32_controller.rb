# frozen_string_literal: true

# F3(後半): ESP32 制御。Wi-Fi(HTTP)でコマンド送信する。
#
# ルール(設計 1.6 F3):
#  - 危険レベルはファン30秒作動。クールダウン10分で重複起動を防止
#  - 送信失敗は最大3回リトライ後スキップし「デバイス未接続」とする(画面表示は継続)
#
# 実デバイスへの HTTP 送信は transport として注入する(テスト・環境非依存)。
# フォールバックで握りつぶさず、成否・試行回数を明示的に返す。
#
# 移植元: src/lib/domain/esp32Controller.ts。
module Esp32Controller
  Result = Struct.new(
    :ok, :device_connected, :command, :fan_activated, :fan_seconds, :attempts,
    keyword_init: true,
  )

  module_function

  def within_cooldown?(last_fan_at, now, cooldown_minutes)
    return false unless last_fan_at

    elapsed_minutes = (now.getutc - last_fan_at.getutc) / 60.0
    elapsed_minutes >= 0 && elapsed_minutes < cooldown_minutes
  end

  # decision: AlertEvaluator::Decision。
  # transport: call(command, fan_seconds) -> true/false(例外は失敗と同義)。
  # last_fan_at: 直近ファン作動時刻(Time or nil)。
  def send(decision, now:, last_fan_at:, transport:, max_retries: nil, cooldown_minutes: nil)
    max_retries ||= AppConfig.esp32[:maxRetries]
    cooldown_minutes ||= AppConfig.esp32[:cooldownMinutes]

    # 危険レベルかつクールダウン外のときだけファンを作動させる。
    wants_fan = decision.level_key == "danger" && decision.fan_seconds > 0
    fan_activated = wants_fan && !within_cooldown?(last_fan_at, now, cooldown_minutes)
    fan_seconds = fan_activated ? decision.fan_seconds : 0

    attempts = 0
    ok = false
    max_retries.times do
      attempts += 1
      begin
        ack = transport.call(decision.command, fan_seconds)
        if ack
          ok = true
          break
        end
      rescue StandardError
        # 通信例外はリトライ対象(握りつぶさず次試行へ)。最終失敗時に device_connected=false。
      end
    end

    Result.new(
      ok: ok,
      device_connected: ok,
      command: decision.command,
      fan_activated: ok && fan_activated,
      fan_seconds: fan_seconds,
      attempts: attempts,
    )
  end
end
