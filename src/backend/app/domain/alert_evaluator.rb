# frozen_string_literal: true

# F3(前半): アラート判定。セッション内全食材の最小残日数からレベルを決める。
#
# ルール(設計 1.6 F3):
#  - 安全(残4日以上)=緑 / 注意(残1〜3日)=黄 / 危険(当日以下・期限切れ)=赤
#  - 食材0件は消灯コマンド
#
# 移植元: src/lib/domain/alertEvaluator.ts。
module AlertEvaluator
  # 判定結果値オブジェクト。
  Decision = Struct.new(
    :level_key, :level_id, :led_color, :command, :fan_seconds, :min_days,
    keyword_init: true,
  )

  module_function

  # commands: [{ level_key:, command:, fan_seconds: }, ...]。
  def command_for(level_key, commands)
    cmd = commands.find { |c| c[:level_key] == level_key }
    raise "esp32_command_master にレベル #{level_key} が存在しません" unless cmd

    cmd
  end

  # expiry_dates: ['YYYY-MM-DD', ...]。now: 現在時刻。
  # levels: [{ id:, key:, min_days:, led_color: }, ...]。commands: 上記。
  def evaluate(expiry_dates, now, levels:, commands:)
    if expiry_dates.empty?
      off = command_for("off", commands)
      return Decision.new(
        level_key: "off",
        level_id: nil,
        led_color: "off",
        command: off[:command],
        fan_seconds: off[:fan_seconds],
        min_days: nil,
      )
    end

    today_iso = JstTime.jst_today_iso(now)
    min_days = expiry_dates.map { |e| JstTime.diff_days_iso(today_iso, e) }.min

    # min_days 降順に並べ、最初に min_days >= level.min_days を満たすレベルを採用する。
    ordered = levels.sort_by { |l| -l[:min_days] }
    level = ordered.find { |l| min_days >= l[:min_days] }
    raise "アラートレベルマスタが不正です(該当レベルなし)" unless level

    cmd = command_for(level[:key], commands)

    Decision.new(
      level_key: level[:key],
      level_id: level[:id],
      led_color: level[:led_color],
      command: cmd[:command],
      fan_seconds: cmd[:fan_seconds],
      min_days: min_days,
    )
  end
end
