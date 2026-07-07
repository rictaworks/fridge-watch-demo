# frozen_string_literal: true

require "rails_helper"

# F4: 日次リセット(設計 1.6 F4)。
RSpec.describe DailyReset do
  describe ".reset_window?" do
    it "JST 03:00(= UTC 18:00 前日)のときだけ true を返す" do
      expect(described_class.reset_window?(Time.utc(2026, 7, 6, 18, 0, 0))).to be(true) # 03:00 JST
      expect(described_class.reset_window?(Time.utc(2026, 7, 6, 18, 1, 0))).to be(false)
      expect(described_class.reset_window?(Time.utc(2026, 7, 7, 3, 0, 0))).to be(false) # 12:00 JST
    end
  end

  describe ".reset_transactions" do
    it "トランザクションを全削除しマスタは保持する" do
      Session.create!(session_id: "s1", created_at: "t", last_accessed_at: "t")
      FoodItem.create!(session_id: "s1", category_id: 1, name: "牛乳",
                       expiry_date: "2026-07-10", is_estimated: 0, registered_at: "t")
      master_count = Category.count

      result = described_class.reset_transactions

      expect(FoodItem.count).to eq(0)
      expect(Session.count).to eq(0)
      expect(result[:total]).to be >= 2
      expect(Category.count).to eq(master_count) # マスタは保持
    end
  end

  describe DailyReset::ResetGate do
    it "実行前後で resetting? は false、実行が全削除を行う" do
      Session.create!(session_id: "s2", created_at: "t", last_accessed_at: "t")
      gate = described_class.new
      expect(gate.resetting?).to be(false)
      gate.run
      expect(gate.resetting?).to be(false)
      expect(Session.count).to eq(0)
    end
  end
end
