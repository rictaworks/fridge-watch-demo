#!/usr/bin/env bash
# PR#1 ユーザーテスト自動実行スクリプト(非エンジニア向け手順を機械実行するもの)。
# 対象: 開発サーバー(src/ を npm run dev で起動)。curl で API を確認する。
# 使い方:
#   1) 別ターミナルで:  cd src && FW_DB_PATH=:memory: PORT=3000 npm run dev
#   2) 本スクリプト:    bash test/pr1/user-test.sh
set -euo pipefail

BASE="${BASE_URL:-http://localhost:3000}"
JAR="$(mktemp)"
pass=0; fail=0

check() { # 説明 実際 期待
  if [ "$2" = "$3" ]; then echo "  OK  : $1"; pass=$((pass+1));
  else echo "  NG  : $1 (実際=$2 期待=$3)"; fail=$((fail+1)); fi
}

jq_get() { python3 -c "import sys,json;d=json.load(sys.stdin);print(eval(sys.argv[1]))" "$1"; }

echo "== 手順1: トップ画面が表示される =="
TITLE=$(curl -s "$BASE/" | grep -c "スマート冷蔵庫管理" || true)
check "トップにタイトルが含まれる" "$([ "$TITLE" -ge 1 ] && echo yes || echo no)" "yes"

echo "== 手順2: 食材を登録すると賞味期限が自動検知される =="
R=$(curl -s -c "$JAR" -b "$JAR" -X POST "$BASE/api/items" -H 'Content-Type: application/json' \
  -d '{"ocrText":"明治牛乳 消費期限 2026.12.10"}')
check "賞味期限が 2026-12-10" "$(echo "$R" | jq_get "d['items'][0]['expiryDate']")" "2026-12-10"
check "カテゴリが乳製品" "$(echo "$R" | jq_get "d['items'][0]['categoryName']")" "乳製品"

echo "== 手順3: 期限切れ食材で危険アラート(赤LED+ファン)=="
R=$(curl -s -c "$JAR" -b "$JAR" -X POST "$BASE/api/items" -H 'Content-Type: application/json' \
  -d '{"ocrText":"古い豚肉 2020-01-01"}')
check "アラートが危険" "$(echo "$R" | jq_get "d['alert']['levelKey']")" "danger"
check "ファン作動" "$(echo "$R" | jq_get "str(d['alert']['fanActivated'])")" "True"

echo "== 手順4: 残量を手動補正すると補充推奨になる =="
ID=$(echo "$R" | jq_get "d['items'][0]['id']")
R=$(curl -s -c "$JAR" -b "$JAR" -X POST "$BASE/api/items/$ID/adjust" -H 'Content-Type: application/json' -d '{"percent":10}')
check "残量10%" "$(echo "$R" | jq_get "[i for i in d['items'] if i['id']==$ID][0]['remainPercent']")" "10"

echo "== 手順5: 別の人(別セッション)には自分の食材が見えない =="
S=$(curl -s -c "$(mktemp)" "$BASE/api/state")
check "別セッションは0件" "$(echo "$S" | jq_get "len(d['items'])")" "0"

echo "== 手順6: リセットで自分の食材を全消去(他人には影響しない)=="
curl -s -c "$JAR" -b "$JAR" -X POST "$BASE/api/reset" >/dev/null
R=$(curl -s -c "$JAR" -b "$JAR" "$BASE/api/state")
check "リセット後0件" "$(echo "$R" | jq_get "len(d['items'])")" "0"

echo ""
echo "結果: 成功 $pass / 失敗 $fail"
[ "$fail" -eq 0 ]
