# frozen_string_literal: true

# F4: 日次リセット(JST 03:00)。
#
# ルール(設計 1.6 F4):
#  - JST 03:00 にトランザクションデータ(食材・補正履歴・アラート履歴・セッション)を全削除
#  - マスタデータは保持
#  - リセット実行中のアクセスには「リセット中」応答を返す(状態は ResetGate が保持)
#
# 移植元: src/lib/domain/dailyReset.ts。
module DailyReset
  # 日次リセットで全削除する(マスタは保持する)トランザクションテーブル(外部キー順)。
  TRANSACTION_TABLES = %w[remain_adjustments alert_logs food_items sessions].freeze

  module_function

  # トランザクションテーブルを全削除する(マスタは触らない)。テーブル別削除件数を返す。
  def reset_transactions
    deleted = {}
    ActiveRecord::Base.transaction do
      TRANSACTION_TABLES.each do |table|
        model = table.classify.constantize
        deleted[table] = model.delete_all
      end
    end
    { deleted: deleted, total: deleted.values.sum }
  end

  # 現在時刻が JST リセット時刻(既定 03:00)の分に一致するか。
  def reset_window?(now)
    shifted = now.getutc + JstTime::JST_OFFSET_SECONDS
    shifted.hour == AppConfig.reset[:hourJst] && shifted.min == AppConfig.reset[:minuteJst]
  end

  # 現在の JST 日付を 'YYYY-MM-DD' で返す(スケジューラ重複実行防止キー用)。
  def jst_date_key(now)
    JstTime.jst_today_iso(now)
  end

  # リセット中フラグ。実行中は「リセット中」応答を返すために参照する。
  # グローバル変数を避け、インスタンスとして生成・注入する。
  class ResetGate
    def initialize
      @resetting = false
    end

    def resetting?
      @resetting
    end

    # リセットを排他実行する。実行中は resetting=true。
    def run
      @resetting = true
      begin
        DailyReset.reset_transactions
      ensure
        @resetting = false
      end
    end
  end
end
