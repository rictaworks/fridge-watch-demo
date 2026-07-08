# frozen_string_literal: true

# F1: カテゴリ自動判定。抽出テキストをキーワード辞書と照合してカテゴリ ID を決める。
# 未ヒット時は「その他」。フォールバックで握りつぶさず、明示的に other_id を返す。
# 移植元: src/lib/domain/categoryClassifier.ts。
module CategoryClassifier
  module_function

  # keywords: [{ category_id:, keyword: }, ...](辞書登録順に走査)。
  def classify(text, keywords, other_id)
    return other_id unless text.is_a?(String) && !text.empty?

    keywords.each do |entry|
      kw = entry[:keyword]
      return entry[:category_id] if kw && !kw.empty? && text.include?(kw)
    end
    other_id
  end
end
