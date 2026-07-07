# frozen_string_literal: true

require "net/http"
require "uri"

# F1: OCR サービス連携。画像を FastAPI(pytesseract + OpenCV)へ転送し抽出テキストを得る。
# 設計 §1.6 F1: 「FastAPI が文字抽出→日付候補抽出」。外部 API/キーは不使用(ローカルのみ)。
#
# エンドポイント URL は設定に分離(既定 http://localhost:8001/ocr、環境変数 FW_OCR_URL で上書き)。
# OCR サービスの起動に依存しないよう、コントローラは ocr_text 直接入力の経路も併用できる。
class OcrClient
  DEFAULT_URL = "http://localhost:8001/ocr"

  def initialize(endpoint: nil, timeout_ms: nil)
    @endpoint = endpoint || ENV["FW_OCR_URL"] || DEFAULT_URL
    @timeout_ms = timeout_ms || 8000
  end

  # 画像バイト列を OCR サービスへ multipart/form-data で送信し、抽出テキストを返す。
  # 失敗は握りつぶさず例外送出(呼び出し側で扱う)。
  def extract(image_bytes:, filename: "upload.jpg", content_type: "application/octet-stream")
    uri = URI.parse(@endpoint)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == "https")
    http.open_timeout = @timeout_ms / 1000.0
    http.read_timeout = @timeout_ms / 1000.0

    boundary = "----FridgeWatch#{SecureRandom.hex(8)}"
    body = build_multipart(boundary, image_bytes, filename, content_type)
    req = Net::HTTP::Post.new(uri.request_uri)
    req["Content-Type"] = "multipart/form-data; boundary=#{boundary}"
    req.body = body

    res = http.request(req)
    raise "OCR サービス応答異常: #{res.code}" unless res.is_a?(Net::HTTPSuccess)

    parsed = JSON.parse(res.body)
    parsed["text"].to_s
  end

  private

  def build_multipart(boundary, bytes, filename, content_type)
    +"--#{boundary}\r\n" \
      "Content-Disposition: form-data; name=\"file\"; filename=\"#{filename}\"\r\n" \
      "Content-Type: #{content_type}\r\n\r\n" \
      "#{bytes}\r\n" \
      "--#{boundary}--\r\n"
  end
end
