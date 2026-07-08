# frozen_string_literal: true

# 登録食材(トランザクション)。session_id を必須オーナーキーとして持つ。
class FoodItem < ApplicationRecord
  self.table_name = "food_items"
end
