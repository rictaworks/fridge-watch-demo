# frozen_string_literal: true

# F4: 日次リセット(JST 03:00 全セッション全削除)。
# 移植元スケジューラ src/server/main.ts の代替。
# 本番のスケジューリング(JST 03:00 起動)は Railway/cron 等のデプロイ基盤に委ねる。
# 例: cron "0 18 * * *"(UTC 18:00 = JST 03:00)で `bin/rails daily_reset:run` を起動。
namespace :daily_reset do
  desc "全セッションのトランザクションデータを削除する(マスタは保持)。F4 日次リセット。"
  task run: :environment do
    result = AppRegistry.reset_gate.run
    Rails.logger.info({ event: "daily_reset", key: DailyReset.jst_date_key(Time.now.utc), deleted: result[:deleted], total: result[:total] }.to_json)
    puts "日次リセット完了: 合計 #{result[:total]} 件削除(#{result[:deleted]})"
  end
end
