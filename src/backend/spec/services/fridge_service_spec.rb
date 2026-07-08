# frozen_string_literal: true

require "rails_helper"

# サービス層(F1〜F3 の統合 + セッション所有分離)。
RSpec.describe FridgeService do
  let(:transport) { ->(_cmd, _sec) { true } }
  let(:service) { described_class.new(transport: transport) }
  let(:now) { Time.utc(2026, 7, 7, 3, 0, 0) } # 2026-07-07 JST
  let(:sid_a) { "aaaaaaaaaaaaaaaa" }
  let(:sid_b) { "bbbbbbbbbbbbbbbb" }

  before do
    Session.create!(session_id: sid_a, created_at: "t", last_accessed_at: "t")
    Session.create!(session_id: sid_b, created_at: "t", last_accessed_at: "t")
  end

  describe "F1 OCR 登録" do
    it "OCR テキストからカテゴリと期限を判定して登録する" do
      view = service.register_from_ocr(sid_a, name: nil, ocr_text: "牛乳 消費期限 2026.07.10", now: now)
      item = view[:items].first
      expect(item[:categoryName]).to eq("乳製品")
      expect(item[:expiryDate]).to eq("2026-07-10")
      expect(item[:isEstimated]).to be(false)
    end

    it "OCR 完全失敗(空文字)は needManual を返し登録しない" do
      result = service.register_from_ocr(sid_a, name: nil, ocr_text: "   ", now: now)
      expect(result).to eq({ needManual: true })
      expect(FoodItem.where(session_id: sid_a).count).to eq(0)
    end

    it "OCR テキストはあるが日付が抽出できない場合は needManual を返し登録しない(デフォルト補完しない)" do
      result = service.register_from_ocr(sid_a, name: "総菜の素", ocr_text: "なにも日付が無いテキスト", now: now)
      expect(result).to eq({ needManual: true })
      expect(FoodItem.where(session_id: sid_a).count).to eq(0)
    end
  end

  describe "F2 残量補正と所有分離" do
    it "自セッションの食材の残量を補正できる" do
      service.register_manual(sid_a, name: "卵", category_id: 6, expiry_date: "2026-07-20", now: now)
      item_id = FoodItem.where(session_id: sid_a).first.id
      view = service.adjust(sid_a, item_id, 55, now)
      expect(view[:items].first[:remainPercent]).to eq(55)
    end

    it "他セッションの食材は補正できない(nil を返す)" do
      service.register_manual(sid_a, name: "卵", category_id: 6, expiry_date: "2026-07-20", now: now)
      item_id = FoodItem.where(session_id: sid_a).first.id
      expect(service.adjust(sid_b, item_id, 55, now)).to be_nil
    end
  end

  describe "セッション所有分離" do
    it "他セッションの食材は一覧に現れない" do
      service.register_manual(sid_a, name: "牛乳", category_id: 1, expiry_date: "2026-07-10", now: now)
      view_b = service.view(sid_b, now)
      expect(view_b[:items]).to be_empty
    end

    it "他セッションの食材は削除できない" do
      service.register_manual(sid_a, name: "牛乳", category_id: 1, expiry_date: "2026-07-10", now: now)
      item_id = FoodItem.where(session_id: sid_a).first.id
      expect(service.remove(sid_b, item_id, now)).to be_nil
      expect(FoodItem.where(id: item_id).count).to eq(1)
    end
  end

  describe "F3 アラート反映" do
    it "期限切れ食材は危険レベル(赤)で、初回はファンを作動させる" do
      # 登録時の初回判定でファン作動(クールダウン前)。
      view = service.register_manual(sid_a, name: "肉", category_id: 2, expiry_date: "2026-07-06", now: now)
      expect(view[:alert][:levelKey]).to eq("danger")
      expect(view[:alert][:ledColor]).to eq("red")
      expect(view[:alert][:fanActivated]).to be(true)

      # 直後の再判定はクールダウン10分以内のためファン非作動(危険表示は継続)。
      again = service.view(sid_a, now)
      expect(again[:alert][:levelKey]).to eq("danger")
      expect(again[:alert][:fanActivated]).to be(false)
    end

    it "食材が無ければ消灯(off)になる" do
      view = service.view(sid_a, now)
      expect(view[:alert][:levelKey]).to eq("off")
    end
  end

  describe "手動リセット(自セッションのみ)" do
    it "自セッションのデータのみ削除する" do
      service.register_manual(sid_a, name: "牛乳", category_id: 1, expiry_date: "2026-07-10", now: now)
      service.register_manual(sid_b, name: "卵", category_id: 6, expiry_date: "2026-07-20", now: now)
      service.clear_own(sid_a, now)
      expect(FoodItem.where(session_id: sid_a).count).to eq(0)
      expect(FoodItem.where(session_id: sid_b).count).to eq(1)
    end
  end
end
