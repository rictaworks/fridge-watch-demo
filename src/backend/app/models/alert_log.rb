# frozen_string_literal: true

# アラート発火履歴(トランザクション)。ファン作動判定にも使用。
class AlertLog < ApplicationRecord
  self.table_name = "alert_logs"
end
