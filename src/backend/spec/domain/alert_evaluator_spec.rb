# frozen_string_literal: true

require "rails_helper"

# F3(前半): アラート判定(設計 1.6 F3)。
RSpec.describe AlertEvaluator do
  let(:levels) { MastersFixture.alert_levels }
  let(:commands) { MastersFixture.esp32_commands }
  let(:now) { Time.utc(2026, 7, 7, 3, 0, 0) } # 2026-07-07 JST
  let(:today) { JstTime.jst_today_iso(now) }

  def evaluate(dates)
    described_class.evaluate(dates, now, levels: levels, commands: commands)
  end

  it "食材0件は消灯(off)コマンドを返す" do
    d = evaluate([])
    expect(d.level_key).to eq("off")
    expect(d.command).to eq("LED_OFF")
    expect(d.min_days).to be_nil
  end

  it "最小残日数4日以上は安全(緑)" do
    d = evaluate([JstTime.add_days_iso(today, 5), JstTime.add_days_iso(today, 4)])
    expect(d.level_key).to eq("safe")
    expect(d.led_color).to eq("green")
    expect(d.command).to eq("LED_GREEN")
    expect(d.min_days).to eq(4)
  end

  it "最小残日数1〜3日は注意(黄)" do
    d = evaluate([JstTime.add_days_iso(today, 2), JstTime.add_days_iso(today, 10)])
    expect(d.level_key).to eq("warning")
    expect(d.led_color).to eq("yellow")
    expect(d.command).to eq("LED_YELLOW")
    expect(d.min_days).to eq(2)
  end

  it "当日以下・期限切れは危険(赤・ファン30秒)" do
    d = evaluate([JstTime.add_days_iso(today, -1), JstTime.add_days_iso(today, 5)])
    expect(d.level_key).to eq("danger")
    expect(d.led_color).to eq("red")
    expect(d.command).to eq("LED_RED_FAN")
    expect(d.fan_seconds).to eq(30)
    expect(d.min_days).to eq(-1)
  end
end
