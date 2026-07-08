# frozen_string_literal: true

module Api
  # POST /api/reset — 手動リセット。自セッションのデータのみ削除する(他来場者のデモは消さない)。
  # 全セッションの全削除は F4 スケジューラ(JST 03:00)のみが行う。
  class ResetController < BaseController
    def create
      result = service.clear_own(session_id, now)
      render json: { ok: true, deleted: result[:deleted], **result[:view] }
    end
  end
end
