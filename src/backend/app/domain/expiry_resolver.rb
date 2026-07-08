# frozen_string_literal: true

# F1: 賞味期限の自動検知(OCR テキスト + 日付パターンマスタ + ルールベース)。
#
# ルール(設計 1.6 F1):
#  - 「消費期限」近傍の日付を最優先、なければ最も未来の日付を採用
#  - 年省略(MM.DD)は「今日以降で最も近い未来日」に補完(年跨ぎ対応)
#  - YY.MM.DD は 2000 年代として補完
#  - 日省略(YYYY.MM / YYYY年MM月)は当該月の末日を賞味期限とし is_estimated=true
#  - 今日から2年超先は誤読として棄却
#  - 採用可能な日付が一つも無ければ nil を返す(呼び出し側で手動入力に誘導する。カテゴリ別デフォルトへのフォールバックは行わない)
#  - 過去日でも採用は許可(即時アラート対象)
#
# 移植元: src/lib/domain/expiryResolver.ts。
module ExpiryResolver
  # 結果値オブジェクト。
  Result = Struct.new(:expiry_date, :is_estimated, :source, :matched_text, keyword_init: true)

  # 「消費期限」近傍として優先扱いする kind。
  PREFER_KINDS = %w[prefer_ymd prefer_ym].freeze
  # 日省略(月末で補完)につき is_estimated 扱いとする kind。
  ESTIMATED_KINDS = %w[ym prefer_ym].freeze

  module_function

  # month/day を検証し、成立するなら ISO 文字列を返す(不正日付は nil)。
  def valid_iso(year, month, day)
    return nil if month < 1 || month > 12 || day < 1 || day > 31
    return nil unless Date.valid_date?(year, month, day)

    JstTime.to_iso_date(year, month, day)
  end

  # 年省略 MM.DD を「今日以降で最も近い未来日」に補完する。
  def complete_year(month, day, today_iso, this_year)
    this_year_iso = valid_iso(this_year, month, day)
    return this_year_iso if this_year_iso && JstTime.diff_days_iso(today_iso, this_year_iso) >= 0

    valid_iso(this_year + 1, month, day)
  end

  # 日省略 YYYY.MM を当該月の末日に補完する。
  def complete_month_end(year, month)
    return nil if month < 1 || month > 12
    return nil unless Date.valid_date?(year, month, 1)

    valid_iso(year, month, Date.new(year, month, -1).day)
  end

  # text: OCR テキスト。
  # patterns: [{ regex:, kind: }, ...](date_pattern_master 由来)。now: 現在時刻(注入)。
  # reject_over_days: 2年超棄却しきい値(既定は AppConfig)。
  # 戻り値: 採用可能な日付が無ければ nil。
  def resolve(text, patterns:, now:, reject_over_days: nil)
    reject_over_days ||= AppConfig.expiry[:rejectOverDays]
    today_iso = JstTime.jst_today_iso(now)
    this_year = JstTime.jst_ymd(now)[:year]
    max_iso = JstTime.add_days_iso(today_iso, reject_over_days)

    candidates = []

    patterns.each do |pattern|
      re = Regexp.new(pattern[:regex])
      text.to_enum(:scan, re).each do
        m = Regexp.last_match
        iso =
          case pattern[:kind]
          when "md"
            complete_year(m[1].to_i, m[2].to_i, today_iso, this_year)
          when "yymd"
            valid_iso(2000 + m[1].to_i, m[2].to_i, m[3].to_i)
          when "ym", "prefer_ym"
            complete_month_end(m[1].to_i, m[2].to_i)
          else # ymd / prefer_ymd
            valid_iso(m[1].to_i, m[2].to_i, m[3].to_i)
          end
        next unless iso
        # 2年超先は誤読として棄却(過去日は許可)。
        next if JstTime.diff_days_iso(today_iso, iso) > reject_over_days
        # max_iso との整合(念のため二重チェック)。
        next if iso > max_iso

        candidates << {
          iso: iso,
          prefer: PREFER_KINDS.include?(pattern[:kind]),
          estimated: ESTIMATED_KINDS.include?(pattern[:kind]),
          matched_text: m[0],
        }
      end
    end

    # 採用可能な日付が一つも無い場合は nil(呼び出し側で手動入力に誘導する)。
    return nil if candidates.empty?

    # 「消費期限」近傍(prefer)を最優先。無ければ全候補から最も未来を採用。
    preferred = candidates.select { |c| c[:prefer] }
    pool = preferred.empty? ? candidates : preferred
    chosen = pool.max_by { |c| c[:iso] }

    Result.new(
      expiry_date: chosen[:iso],
      is_estimated: chosen[:estimated],
      source: chosen[:estimated] ? "ocr_month" : "ocr",
      matched_text: chosen[:matched_text],
    )
  end
end
