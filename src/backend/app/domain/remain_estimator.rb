# frozen_string_literal: true

# F2: 残量推定(ルールベース)。
#
# ルール(設計 1.6 F2):
#  - 残量% = 基準残量 −(基準時刻からの経過日数 × カテゴリ別日次消費率)
#  - 基準は最新の手動補正(値・時刻)、無ければ登録時(100%)
#  - 結果は 0〜100% にクランプ。補正入力も 0〜100% にクランプ
#  - 端末時刻異常(基準時刻より過去)は基準残量をそのまま表示
#  - 残量 20% 以下で補充推奨フラグ
#
# 移植元: src/lib/domain/remainEstimator.ts。
module RemainEstimator
  Result = Struct.new(:percent, :restock, keyword_init: true)

  module_function

  # 0〜100 にクランプし整数へ丸める(補正入力にも使用)。
  def clamp_percent(value)
    conf = AppConfig.remain
    rounded = value.round
    return conf[:min] if rounded < conf[:min]
    return conf[:max] if rounded > conf[:max]

    rounded
  end

  # base_percent: 基準残量。base_at: 基準時刻(Time)。rate_per_day: 日次消費率。now: 現在時刻。
  def estimate(base_percent:, base_at:, rate_per_day:, now:)
    # 端末時刻異常(now < base_at)は elapsed_days が 0 を返すため基準残量のまま。
    days = JstTime.elapsed_days(base_at, now)
    raw = base_percent - days * rate_per_day
    percent = clamp_percent(raw)
    restock = percent <= AppConfig.remain[:restockThreshold]
    Result.new(percent: percent, restock: restock)
  end
end
