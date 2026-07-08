# frozen_string_literal: true

# セッション(認証なしデモ版のオーナーキー)。個人情報は保持しない。
class Session < ApplicationRecord
  self.table_name = "sessions"
  self.primary_key = "session_id"
end
