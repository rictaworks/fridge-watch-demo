# frozen_string_literal: true

require "rails_helper"

# F1: カテゴリ自動判定(設計 1.6 F1)。
RSpec.describe CategoryClassifier do
  let(:keywords) { MastersFixture.category_keywords }
  let(:other_id) { MastersFixture.other_category_id }

  it "キーワード辞書に一致したカテゴリ ID を返す" do
    expect(described_class.classify("成分無調整 牛乳 1L", keywords, other_id)).to eq(1) # 乳製品
    expect(described_class.classify("国産 豚肉 こま切れ", keywords, other_id)).to eq(2) # 肉
    expect(described_class.classify("新鮮 鮭 切り身", keywords, other_id)).to eq(3) # 魚介
  end

  it "未ヒットは「その他」を返す(フォールバックで握りつぶさない)" do
    expect(described_class.classify("正体不明の食品", keywords, other_id)).to eq(other_id)
  end

  it "空文字/非文字列は「その他」を返す" do
    expect(described_class.classify("", keywords, other_id)).to eq(other_id)
    expect(described_class.classify(nil, keywords, other_id)).to eq(other_id)
  end
end
