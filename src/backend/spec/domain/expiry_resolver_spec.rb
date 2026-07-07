# frozen_string_literal: true

require "rails_helper"

# F1: 賞味期限の自動検知(設計 1.6 F1)。
RSpec.describe ExpiryResolver do
  let(:patterns) { MastersFixture.date_patterns }
  # 2026-07-07 12:00 JST(= 2026-07-07 03:00 UTC)。
  let(:now) { Time.utc(2026, 7, 7, 3, 0, 0) }

  def resolve(text, default_days: 5)
    described_class.resolve(text, patterns: patterns, default_days: default_days, now: now)
  end

  it "「消費期限」接頭を最優先し、より未来の日付より優先する" do
    result = resolve("消費期限 2026.07.10 賞味期限 2027.01.01")
    expect(result.expiry_date).to eq("2026-07-10")
    expect(result.is_estimated).to be(false)
    expect(result.source).to eq("ocr")
  end

  it "prefer が無ければ最も未来の日付を採用する" do
    result = resolve("2026.07.10 2026.12.31")
    expect(result.expiry_date).to eq("2026-12-31")
  end

  it "年省略(MM.DD)は今日以降で最も近い未来日に補完する(年跨ぎ)" do
    expect(resolve("01/05").expiry_date).to eq("2027-01-05") # 今年は過去 → 翌年
    expect(resolve("12/31").expiry_date).to eq("2026-12-31") # 今年が未来 → 今年
  end

  it "YY.MM.DD は 2000 年代として補完する" do
    expect(resolve("28.03.15").expiry_date).to eq("2028-03-15")
  end

  it "今日から2年超先の日付は誤読として棄却し、デフォルト補完(推定)する" do
    result = resolve("2099.01.01", default_days: 5)
    expect(result.is_estimated).to be(true)
    expect(result.source).to eq("default")
    expect(result.expiry_date).to eq("2026-07-12") # today + 5
  end

  it "採用可能な日付が無ければカテゴリ別デフォルト期限で補完する" do
    result = resolve("なにも日付が無いテキスト", default_days: 3)
    expect(result.is_estimated).to be(true)
    expect(result.expiry_date).to eq("2026-07-10") # today + 3
  end

  it "過去日でも採用する(即時アラート対象)" do
    result = resolve("2026.07.01")
    expect(result.expiry_date).to eq("2026-07-01")
    expect(result.is_estimated).to be(false)
  end
end
