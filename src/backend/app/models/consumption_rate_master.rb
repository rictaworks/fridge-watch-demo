# frozen_string_literal: true

# カテゴリ別日次消費率マスタ(§1.7 consumption_rate 8件)。
class ConsumptionRateMaster < ApplicationRecord
  self.table_name = "consumption_rate_master"
  self.primary_key = "category_id"
end
