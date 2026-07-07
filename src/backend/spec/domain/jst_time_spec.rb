# frozen_string_literal: true

require "rails_helper"

RSpec.describe JstTime do
  describe ".jst_today_iso" do
    it "UTC 瞬間を JST カレンダー日に変換する(UTC 18:00 は翌日 JST 03:00)" do
      # 2026-07-06 18:00 UTC = 2026-07-07 03:00 JST
      expect(JstTime.jst_today_iso(Time.utc(2026, 7, 6, 18, 0, 0))).to eq("2026-07-07")
    end
  end

  describe ".diff_days_iso" do
    it "同日=0 / 翌日=1 / 前日=-1 を返す" do
      expect(JstTime.diff_days_iso("2026-07-07", "2026-07-07")).to eq(0)
      expect(JstTime.diff_days_iso("2026-07-07", "2026-07-08")).to eq(1)
      expect(JstTime.diff_days_iso("2026-07-07", "2026-07-06")).to eq(-1)
      expect(JstTime.diff_days_iso("2026-07-07", "2026-07-17")).to eq(10)
    end
  end

  describe ".add_days_iso" do
    it "月跨ぎ・年跨ぎを正しく加算する" do
      expect(JstTime.add_days_iso("2026-07-07", 5)).to eq("2026-07-12")
      expect(JstTime.add_days_iso("2026-12-30", 5)).to eq("2027-01-04")
    end
  end

  describe ".elapsed_days" do
    it "経過日数を切り捨てで返し、負値は 0 とする" do
      base = Time.utc(2026, 7, 7, 0, 0, 0)
      expect(JstTime.elapsed_days(base, base + 2 * 86_400 + 3600)).to eq(2)
      expect(JstTime.elapsed_days(base, base - 3600)).to eq(0)
    end
  end
end
