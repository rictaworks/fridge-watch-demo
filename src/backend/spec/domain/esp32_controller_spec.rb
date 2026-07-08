# frozen_string_literal: true

require "rails_helper"

# F3(後半): ESP32 制御(設計 1.6 F3)。
RSpec.describe Esp32Controller do
  let(:now) { Time.utc(2026, 7, 7, 3, 0, 0) }

  def danger
    AlertEvaluator::Decision.new(
      level_key: "danger", level_id: 3, led_color: "red",
      command: "LED_RED_FAN", fan_seconds: 30, min_days: -1
    )
  end

  def safe
    AlertEvaluator::Decision.new(
      level_key: "safe", level_id: 1, led_color: "green",
      command: "LED_GREEN", fan_seconds: 0, min_days: 5
    )
  end

  it "危険レベルはファン30秒を作動させ、ACK で接続成功とする" do
    calls = []
    transport = ->(cmd, sec) { calls << [cmd, sec]; true }
    r = described_class.send(danger, now: now, last_fan_at: nil, transport: transport)
    expect(r.ok).to be(true)
    expect(r.device_connected).to be(true)
    expect(r.fan_activated).to be(true)
    expect(r.fan_seconds).to eq(30)
    expect(r.attempts).to eq(1)
    expect(calls).to eq([["LED_RED_FAN", 30]])
  end

  it "クールダウン10分以内は重複ファン起動を抑止する(fan_seconds=0)" do
    transport = ->(_cmd, _sec) { true }
    last = now - 5 * 60 # 5分前
    r = described_class.send(danger, now: now, last_fan_at: last, transport: transport)
    expect(r.fan_activated).to be(false)
    expect(r.fan_seconds).to eq(0)
  end

  it "クールダウン経過後(10分超)は再度ファンを作動させる" do
    transport = ->(_cmd, _sec) { true }
    last = now - 11 * 60
    r = described_class.send(danger, now: now, last_fan_at: last, transport: transport)
    expect(r.fan_activated).to be(true)
    expect(r.fan_seconds).to eq(30)
  end

  it "送信失敗は最大3回リトライ後スキップし『デバイス未接続』とする" do
    attempts = 0
    transport = ->(_cmd, _sec) { attempts += 1; false }
    r = described_class.send(danger, now: now, last_fan_at: nil, transport: transport)
    expect(r.ok).to be(false)
    expect(r.device_connected).to be(false)
    expect(r.fan_activated).to be(false)
    expect(r.attempts).to eq(3)
    expect(attempts).to eq(3)
  end

  it "送信例外もリトライ対象とし、握りつぶさず未接続として返す" do
    attempts = 0
    transport = ->(_cmd, _sec) { attempts += 1; raise "network down" }
    r = described_class.send(danger, now: now, last_fan_at: nil, transport: transport)
    expect(r.ok).to be(false)
    expect(r.attempts).to eq(3)
  end

  it "安全レベルはファンを作動させない" do
    r = described_class.send(safe, now: now, last_fan_at: nil, transport: ->(_c, _s) { true })
    expect(r.fan_activated).to be(false)
    expect(r.fan_seconds).to eq(0)
    expect(r.device_connected).to be(true)
  end
end
