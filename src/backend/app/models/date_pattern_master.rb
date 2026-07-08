# frozen_string_literal: true

# 日付パターンマスタ(§1.7 date_patterns 6件)。F1 期限抽出の正規表現辞書。
class DatePatternMaster < ApplicationRecord
  self.table_name = "date_pattern_master"
end
