# frozen_string_literal: true

module Api
  # 食材の登録(F1)・残量補正(F2)・削除。
  class ItemsController < BaseController
    # POST /api/items — F1 OCR 登録。
    # 本番は画像(image)を OCR サービス(FastAPI)へ転送して text を得る。
    # テスト/フロント OCR 経路では ocrText を直接受ける。
    def create
      if honeypot_triggered?
        # Bot とみなし破棄。登録せず現状ビューを返す(攻撃者に成否を悟らせない)。
        render json: service.view(session_id, now)
        return
      end

      ocr_text = resolve_ocr_text
      result = service.register_from_ocr(session_id, name: params[:name], ocr_text: ocr_text, now: now)
      render json: result
    end

    # POST /api/items/manual — F1 手動フォールバック登録。
    def manual
      if honeypot_triggered?
        render json: service.view(session_id, now)
        return
      end

      category_id = strict_integer(params[:categoryId])
      expiry_date = params[:expiryDate].to_s
      if category_id.nil? || !expiry_date.match?(/\A\d{4}-\d{2}-\d{2}\z/)
        return render_invalid_input
      end

      view = service.register_manual(
        session_id, name: params[:name], category_id: category_id, expiry_date: expiry_date, now: now
      )
      render json: view
    end

    # POST /api/items/:id/adjust — F2 残量手動補正。
    def adjust
      id = strict_integer(params[:id])
      percent = strict_number(params[:percent])
      return render_invalid_input if id.nil? || percent.nil?

      view = service.adjust(session_id, id, percent, now)
      return render_not_found if view.nil?

      render json: view
    end

    # DELETE /api/items/:id — 食材削除(自セッションのみ)。
    def destroy
      id = strict_integer(params[:id])
      return render_invalid_input if id.nil?

      view = service.remove(session_id, id, now)
      return render_not_found if view.nil?

      render json: view
    end

    private

    # OCR テキストの解決。ocrText 直接入力を最優先、無ければ image を OCR サービスへ転送。
    def resolve_ocr_text
      direct = params[:ocrText] || params[:ocr_text]
      return direct.to_s if direct.present?

      image = params[:image] || params[:file]
      return "" unless image.respond_to?(:read)

      OcrClient.new.extract(
        image_bytes: image.read,
        filename: image.try(:original_filename) || "upload.jpg",
        content_type: image.try(:content_type) || "application/octet-stream",
      )
    end
  end
end
