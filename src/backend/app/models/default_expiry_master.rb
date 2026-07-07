# frozen_string_literal: true

# カテゴリ別デフォルト賞味期限日数マスタ(§1.7 default_expiry 8件)。
class DefaultExpiryMaster < ApplicationRecord
  self.table_name = "default_expiry_master"
  self.primary_key = "category_id"
end
