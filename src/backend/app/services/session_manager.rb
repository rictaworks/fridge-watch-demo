# frozen_string_literal: true

# セッション管理(デモ版: 認証なし)。
# セッションIDを全トランザクションテーブルのオーナーキーとして扱い、
# セッションを跨いだ参照・操作を禁止する。個人情報は保持しない。
# 移植元: src/lib/session.ts。
class SessionManager
  HEX_FORMAT = /\A[0-9a-f]+\z/

  # 新規セッションIDを暗号論的乱数で発行する。
  def generate_id
    SecureRandom.hex(AppConfig.session[:idBytes])
  end

  # Cookie 由来のセッションIDを検証し、存在すれば last_accessed を更新して返す。
  # 未存在/不正なら新規発行してレコードを作成する。
  def ensure(cookie_id, now)
    now_iso = JstTime.iso8601(now)
    if cookie_id && cookie_id.match?(HEX_FORMAT)
      row = Session.find_by(session_id: cookie_id)
      if row
        row.update!(last_accessed_at: now_iso)
        return cookie_id
      end
    end
    id = generate_id
    Session.create!(session_id: id, created_at: now_iso, last_accessed_at: now_iso)
    id
  end
end
