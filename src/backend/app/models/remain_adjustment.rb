# frozen_string_literal: true

# 残量手動補正履歴(トランザクション)。session_id 所有スコープを持つ。
class RemainAdjustment < ApplicationRecord
  self.table_name = "remain_adjustments"
end
