#!/usr/bin/env python3
"""
PR#4 通しテスト(非エンジニア向け手順の自動実行版)。
test/pr1/user-test.sh の全体フロー(登録・アラート・残量調整・セッション分離・リセット)に加え、
PR#4 で変更した賞味期限解決ロジック(年月のみ表記・日付不明時のnil化)の回帰確認を行う。

使い方:
  BASE_URL=https://fridge-watch-demo.rictaworks.jp python3 test/pr4/user-test.py
  (BASE_URL省略時は http://localhost:3000 を使う)
"""
import json
import os
import sys
import urllib.request

BASE = os.environ.get("BASE_URL", "http://localhost:3000")
pass_count = 0
fail_count = 0
cookie = None


def check(label, actual, expected):
    global pass_count, fail_count
    if actual == expected:
        print(f"  OK  : {label}")
        pass_count += 1
    else:
        print(f"  NG  : {label} (実際={actual!r} 期待={expected!r})")
        fail_count += 1


def request(method, path, body=None):
    global cookie
    url = f"{BASE}{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    if cookie:
        req.add_header("Cookie", cookie)
    with urllib.request.urlopen(req) as res:
        set_cookie = res.headers.get("Set-Cookie")
        if set_cookie:
            cookie = set_cookie.split(";", 1)[0]
        raw = res.read().decode("utf-8")
        return json.loads(raw) if raw else {}


print("== 手順1: 通常の日付表記(YYYY.MM.DD)で正しく登録される(既存機能の回帰確認) ==")
r = request("POST", "/api/items", {"ocrText": "明治牛乳 消費期限 2026.12.10"})
check("賞味期限が 2026-12-10", r["items"][0]["expiryDate"], "2026-12-10")
check("カテゴリが乳製品", r["items"][0]["categoryName"], "乳製品")
check("推定バッジが付かない(実測日付のため)", r["items"][0]["isEstimated"], False)
item1_id = r["items"][0]["id"]

print("== 手順2(PR#4新規): 年月のみ表記(日省略)で月末日に解決される ==")
r = request("POST", "/api/items", {"ocrText": "冷凍餃子 消費期限 2028.04"})
new_item = [i for i in r["items"] if i["id"] != item1_id][0]
check("賞味期限が当該月末日 2028-04-30", new_item["expiryDate"], "2028-04-30")
check("推定バッジが付く", new_item["isEstimated"], True)

print("== 手順3(PR#4新規): 日付が一切読めない場合はneedManualになり登録されない ==")
before_count = len(r["items"])
r2 = request("POST", "/api/items", {"ocrText": "謎の食品 日付不明"})
check("needManualがTrue", r2.get("needManual"), True)
r3 = request("GET", "/api/state")
check("食材件数が増えていない(無言デフォルト登録されない)", len(r3["items"]), before_count)

print("== 手順4: 期限切れ食材で危険アラート(赤LED+ファン)(既存機能の回帰確認) ==")
r = request("POST", "/api/items", {"ocrText": "古い豚肉 2020-01-01"})
check("アラートが危険", r["alert"]["levelKey"], "danger")
check("ファン作動", r["alert"]["fanActivated"], True)
danger_item_id = [i for i in r["items"] if i["expiryDate"] == "2020-01-01"][0]["id"]

print("== 手順5: 残量を手動補正すると反映される(既存機能の回帰確認) ==")
r = request("POST", f"/api/items/{danger_item_id}/adjust", {"percent": 10})
adjusted = [i for i in r["items"] if i["id"] == danger_item_id][0]
check("残量10%", adjusted["remainPercent"], 10)

print("== 手順6: リセットで自分の食材を全消去(既存機能の回帰確認) ==")
r = request("POST", "/api/reset")
check("リセット後0件", len(r["items"]), 0)

print()
print(f"結果: 成功 {pass_count} / 失敗 {fail_count}")
sys.exit(1 if fail_count else 0)
