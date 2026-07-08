# frozen_string_literal: true

require "rails_helper"

# F2: 残量推定(設計 1.6 F2)。
RSpec.describe RemainEstimator do
  describe ".clamp_percent" do
    it "0〜100 にクランプし整数に丸める" do
      expect(described_class.clamp_percent(-10)).to eq(0)
      expect(described_class.clamp_percent(150)).to eq(100)
      expect(described_class.clamp_percent(42.6)).to eq(43)
    end
  end

  describe ".estimate" do
    let(:base_at) { Time.utc(2026, 7, 1, 0, 0, 0) }

    it "残量% = 基準残量 −(経過日数 × 日次消費率)" do
      now = base_at + 3 * 86_400 # 3日経過
      result = described_class.estimate(base_percent: 100, base_at: base_at, rate_per_day: 20, now: now)
      expect(result.percent).to eq(40) # 100 - 3*20
      expect(result.restock).to be(false)
    end

    it "残量 20% 以下で補充推奨フラグが立つ" do
      now = base_at + 4 * 86_400 # 4日経過
      result = described_class.estimate(base_percent: 100, base_at: base_at, rate_per_day: 20, now: now)
      expect(result.percent).to eq(20) # 100 - 80
      expect(result.restock).to be(true)
    end

    it "0% 未満は 0 にクランプする" do
      now = base_at + 10 * 86_400
      result = described_class.estimate(base_percent: 100, base_at: base_at, rate_per_day: 30, now: now)
      expect(result.percent).to eq(0)
      expect(result.restock).to be(true)
    end

    it "端末時刻異常(now < base_at)は基準残量のまま表示する" do
      now = base_at - 5 * 86_400
      result = described_class.estimate(base_percent: 80, base_at: base_at, rate_per_day: 25, now: now)
      expect(result.percent).to eq(80)
    end
  end
end
