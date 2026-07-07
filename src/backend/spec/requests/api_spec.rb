# frozen_string_literal: true

require "rails_helper"

# API 契約(移植元 src/server/app.ts)。ハニーポット・セッション所有分離・リセット503。
RSpec.describe "API", type: :request do
  # 2026-07-07 12:00 JST(リセット時刻外)。
  let(:test_now) { "2026-07-07T03:00:00Z" }
  let(:time_header) { { "X-Test-Now" => test_now } }

  # 発行された fw_session Cookie 値を取り出す。
  def session_cookie(response)
    response.cookies["fw_session"]
  end

  describe "GET /api/masters" do
    it "カテゴリ8件とロケール設定を返し、Cookie を発行する" do
      get "/api/masters", headers: time_header
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["categories"].size).to eq(8)
      expect(body["locales"]).to include("ja", "ar")
      expect(session_cookie(response)).to be_present
    end
  end

  describe "POST /api/items(F1 OCR 登録)" do
    it "ocrText から登録し、一覧に反映する" do
      post "/api/items", params: { ocrText: "牛乳 消費期限 2026.07.10" }, headers: time_header
      expect(response).to have_http_status(:ok)
      items = response.parsed_body["items"]
      expect(items.size).to eq(1)
      expect(items.first["categoryName"]).to eq("乳製品")
      expect(items.first["expiryDate"]).to eq("2026-07-10")
    end

    it "OCR 完全失敗は needManual を返す" do
      post "/api/items", params: { ocrText: "" }, headers: time_header
      expect(response.parsed_body).to eq({ "needManual" => true })
    end

    it "ハニーポット項目 website に入力があれば破棄する(登録しない)" do
      post "/api/items", params: { ocrText: "牛乳 2026.07.10", website: "http://bot" }, headers: time_header
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["items"]).to be_empty
    end
  end

  describe "POST /api/items/manual(F1 手動)" do
    it "カテゴリと期限で登録する" do
      post "/api/items/manual", params: { categoryId: 6, expiryDate: "2026-07-20", name: "卵" }, headers: time_header
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["items"].first["categoryName"]).to eq("卵")
    end

    it "不正な期限フォーマットは 400 を返す" do
      post "/api/items/manual", params: { categoryId: 6, expiryDate: "bad" }, headers: time_header
      expect(response).to have_http_status(:bad_request)
      expect(response.parsed_body["error"]).to eq("invalid_input")
    end
  end

  describe "セッション所有分離" do
    it "別セッションからは他人の食材が見えない" do
      # セッション A で1件登録(統合セッションの Cookie ジャーが A を保持)。
      post "/api/items/manual", params: { categoryId: 1, expiryDate: "2026-07-10" }, headers: time_header
      get "/api/state", headers: time_header
      expect(response.parsed_body["items"].size).to eq(1)

      # Cookie を破棄し新規セッション B に切り替えると0件。
      cookies.delete("fw_session")
      get "/api/state", headers: time_header
      expect(response.parsed_body["items"].size).to eq(0)
    end
  end

  describe "POST /api/items/:id/adjust(F2)" do
    it "存在しない食材は 404 を返す" do
      post "/api/items/99999/adjust", params: { percent: 50 }, headers: time_header
      expect(response).to have_http_status(:not_found)
    end

    it "percent が数値でなければ 400 を返す" do
      post "/api/items/1/adjust", params: { percent: "abc" }, headers: time_header
      expect(response).to have_http_status(:bad_request)
    end
  end

  describe "POST /api/reset(自セッションのみ)" do
    it "自セッションのデータを削除して ok を返す" do
      post "/api/items/manual", params: { categoryId: 1, expiryDate: "2026-07-10" }, headers: time_header
      cookie_a = session_cookie(response)
      post "/api/reset", headers: time_header.merge("Cookie" => cookie_a)
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["ok"]).to be(true)
      expect(response.parsed_body["items"]).to be_empty
    end
  end

  describe "日次リセット時刻(F4)" do
    it "JST 03:00 のアクセスは 503 resetting を返す" do
      get "/api/state", headers: { "X-Test-Now" => "2026-07-06T18:00:00Z" } # 03:00 JST
      expect(response).to have_http_status(:service_unavailable)
      expect(response.parsed_body["error"]).to eq("resetting")
    end
  end

  describe "GET /api/device" do
    it "デバイスモードを返す(既定 virtual)" do
      get "/api/device", headers: time_header
      expect(response).to have_http_status(:ok)
      expect(%w[virtual http off]).to include(response.parsed_body["mode"])
    end
  end
end
