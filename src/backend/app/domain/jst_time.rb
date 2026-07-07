# frozen_string_literal: true

# 時刻ユーティリティ。プロジェクト規約により時刻は JST(UTC+9)で統一する。
# 「現在時刻」は各ドメイン関数へ引数注入する(グローバル参照禁止)。
# 移植元: src/lib/util/time.ts。
module JstTime
  JST_OFFSET_SECONDS = 9 * 3600

  module_function

  # 与えた瞬間を JST のカレンダー日 {year, month, day} に分解する。
  def jst_ymd(instant)
    shifted = instant.getutc + JST_OFFSET_SECONDS
    { year: shifted.year, month: shifted.month, day: shifted.day }
  end

  # JST カレンダー日を 'YYYY-MM-DD' に整形する。
  def to_iso_date(year, month, day)
    format("%04d-%02d-%02d", year, month, day)
  end

  # 与えた瞬間の JST 当日を 'YYYY-MM-DD' で返す。
  def jst_today_iso(instant)
    ymd = jst_ymd(instant)
    to_iso_date(ymd[:year], ymd[:month], ymd[:day])
  end

  # 'YYYY-MM-DD' を JST 正午の UTC 瞬間として解釈する(DST 無しの安全な基準点)。
  # JST 正午 = UTC 03:00。
  def iso_to_utc_noon(iso)
    y, m, d = iso.split("-").map(&:to_i)
    Time.utc(y, m, d, 3, 0, 0)
  end

  # from(基準日)から to(対象日)までの JST カレンダー日数差。同日=0、翌日=1、前日=-1。
  def diff_days_iso(from_iso, to_iso)
    ((iso_to_utc_noon(to_iso) - iso_to_utc_noon(from_iso)) / 86_400.0).round
  end

  # ISO 日付に日数を加算した ISO 日付を返す。
  def add_days_iso(iso, days)
    base = iso_to_utc_noon(iso) + days * 86_400
    shifted = base + JST_OFFSET_SECONDS
    to_iso_date(shifted.year, shifted.month, shifted.day)
  end

  # 瞬間を ISO8601(UTC, ミリ秒精度)文字列にする(DB 保存用。移植元 Date#toISOString 相当)。
  def iso8601(time)
    time.getutc.iso8601(3)
  end

  # 経過秒を経過日数(切り捨て、負値は 0)に変換する。残量推定で使用。
  def elapsed_days(from_instant, to_instant)
    seconds = to_instant.getutc - from_instant.getutc
    return 0 if seconds <= 0

    (seconds / 86_400.0).floor
  end
end
