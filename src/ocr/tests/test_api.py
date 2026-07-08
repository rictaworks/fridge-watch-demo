"""API 統合テスト(FastAPI TestClient)。

設計 1.6 F1 手順1-2 の「文字抽出」を検証する。日本語 OCR は完璧で
なくてよいが、数字・記号(日付)が読めることを必須とする。
"""
from __future__ import annotations

import re

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import app
from tests.helpers import find_cjk_font, make_large_png, render_text_png

client = TestClient(app)


def _normalize_digits(text: str) -> str:
    """OCR が空白や区切りを揺らしても比較できるよう数字のみ連結する。"""
    return "".join(ch for ch in text if ch.isdigit())


def test_health_ok():
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["lang"] == get_settings().ocr_lang


def test_ocr_reads_date_string():
    png = render_text_png(["2026.12.31"], font_size=80, prefer_cjk=False)
    res = client.post("/ocr", files={"file": ("date.png", png, "image/png")})
    assert res.status_code == 200
    body = res.json()
    assert body["lang"] == "jpn+eng"
    # 日付の数字列が読めていること(2026 12 31)。
    assert "20261231" in _normalize_digits(body["text"])


def test_ocr_reads_label_and_date_japanese():
    """消費期限 + 日付。CJK フォントがあれば日本語も含めて描画する。"""
    png = render_text_png(["消費期限", "2026.12.31"], font_size=72, prefer_cjk=True)
    res = client.post("/ocr", files={"file": ("package.png", png, "image/png")})
    assert res.status_code == 200
    body = res.json()
    digits = _normalize_digits(body["text"])
    assert "20261231" in digits
    if find_cjk_font() is not None:
        # 日本語ラベルは完璧でなくてよいが、いずれかの文字が拾えること。
        assert any(c in body["text"] for c in "消費期限")


def test_ocr_reads_slash_date():
    png = render_text_png(["2027/03/05"], font_size=80, prefer_cjk=False)
    res = client.post("/ocr", files={"file": ("slash.png", png, "image/png")})
    assert res.status_code == 200
    assert "20270305" in _normalize_digits(res.json()["text"])


def test_ocr_rejects_broken_image_with_400():
    res = client.post(
        "/ocr",
        files={"file": ("broken.png", b"not-an-image-content", "image/png")},
    )
    assert res.status_code == 400
    assert "error" in res.json()


def test_ocr_downscales_oversize_image():
    settings = get_settings()
    png = make_large_png(settings.max_upload_bytes + 1)
    res = client.post("/ocr", files={"file": ("big.png", png, "image/png")})
    assert res.status_code == 200
    # 大きな画像でも縮小して日付が読めること。
    assert "20261231" in _normalize_digits(res.json()["text"])


def test_ocr_response_contract_keys():
    png = render_text_png(["2026.01.01"], font_size=80, prefer_cjk=False)
    res = client.post("/ocr", files={"file": ("c.png", png, "image/png")})
    body = res.json()
    assert set(body.keys()) == {"text", "lang"}
    assert isinstance(body["text"], str)
