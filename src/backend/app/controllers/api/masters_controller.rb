# frozen_string_literal: true

module Api
  # GET /api/masters — カテゴリ一覧と i18n ロケール設定を返す。
  class MastersController < BaseController
    def index
      render json: {
        categories: MastersRepository.new.categories,
        locales: AppConfig.i18n[:locales],
        rtlLocales: AppConfig.i18n[:rtlLocales],
      }
    end
  end
end
