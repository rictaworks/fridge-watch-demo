# frozen_string_literal: true

module Api
  # GET /api/state — 現在の冷蔵庫ビュー(食材一覧 + 残量 + アラート)。
  class StateController < BaseController
    def show
      render json: service.view(session_id, now)
    end
  end
end
