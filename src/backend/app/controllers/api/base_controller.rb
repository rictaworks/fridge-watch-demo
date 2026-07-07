# frozen_string_literal: true

module Api
  # API 共通基底。デモ版方針: 認証なし・セッションID所有分離・ハニーポットBot対策。
  # 日次リセット中/リセット時刻は 503「リセット中」を返す。フォールバックで握りつぶさない。
  # 移植元: src/server/app.ts。
  class BaseController < ActionController::API
    include ActionController::Cookies

    HONEYPOT_FIELD = "website"

    before_action :guard_reset_window
    before_action :ensure_session

    rescue_from StandardError, with: :handle_internal_error

    private

    # 現在時刻(UTC)。テスト容易性のため開発/テスト環境ではヘッダ X-Test-Now で上書き可能。
    def now
      if !Rails.env.production? && (override = request.headers["X-Test-Now"]).present?
        return Time.iso8601(override).utc
      end

      Time.now.utc
    end

    # 日次リセット中は全 API を 503 で応答する。
    def guard_reset_window
      return unless AppRegistry.reset_gate.resetting? || DailyReset.reset_window?(now)

      render json: { error: "resetting", message_key: "error.resetting" }, status: :service_unavailable
    end

    # セッション確保(なければ発行しCookieをSet)。全 /api で有効。
    def ensure_session
      cookie_name = AppConfig.session[:cookieName]
      @session_id = SessionManager.new.ensure(cookies[cookie_name], now)
      cookies[cookie_name] = {
        value: @session_id,
        httponly: true,
        same_site: :lax,
        path: "/",
        secure: Rails.env.production?,
      }
    end

    attr_reader :session_id

    def service
      @service ||= FridgeService.new(transport: AppRegistry.device.transport)
    end

    # ハニーポット項目に入力があれば true(Bot とみなし破棄)。
    def honeypot_triggered?
      v = params[HONEYPOT_FIELD]
      v.is_a?(String) && !v.strip.empty?
    end

    # 厳密な整数変換(整数でなければ nil)。移植元の Number.isInteger 相当。
    def strict_integer(value)
      return value if value.is_a?(Integer)

      Integer(value.to_s, 10)
    rescue ArgumentError, TypeError
      nil
    end

    # 有限数への変換(数値でなければ nil)。移植元の Number.isFinite 相当。
    def strict_number(value)
      return value if value.is_a?(Numeric)

      Float(value.to_s)
    rescue ArgumentError, TypeError
      nil
    end

    def render_invalid_input
      render json: { error: "invalid_input", message_key: "error.invalid_input" }, status: :bad_request
    end

    def render_not_found
      render json: { error: "not_found", message_key: "error.not_found" }, status: :not_found
    end

    # 握りつぶさず 500 + トレース可能な構造化ログを出す(秘匿情報は出さない)。
    def handle_internal_error(error)
      Rails.logger.error(
        {
          event: "api_error",
          path: request.path,
          method: request.method,
          error_class: error.class.name,
          message: error.message,
          backtrace: error.backtrace&.first(5),
        }.to_json,
      )
      render json: { error: "internal", message_key: "error.internal" }, status: :internal_server_error
    end
  end
end
