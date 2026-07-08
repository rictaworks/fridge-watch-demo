"""テスト用の画像生成ユーティリティ。

PIL でパッケージ風の文字画像(消費期限・日付)を生成し、OCR の
入力とする。CJK フォントが無い環境では日本語ラベルの描画を諦め、
数字・記号のみを検証できるようフォールバックせず明示的に選択する。
"""
from __future__ import annotations

import io
import os
from typing import Optional

from PIL import Image, ImageDraw, ImageFont

# 環境で確認済みの日本語対応フォント(fonts-noto-cjk)。
_CJK_FONT_CANDIDATES = (
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
)
_ASCII_FONT_CANDIDATES = (
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
)


def find_cjk_font() -> Optional[str]:
    for path in _CJK_FONT_CANDIDATES:
        if os.path.exists(path):
            return path
    return None


def find_ascii_font() -> str:
    for path in _ASCII_FONT_CANDIDATES:
        if os.path.exists(path):
            return path
    raise FileNotFoundError("ASCII 描画用フォントが見つかりません")


def render_text_png(lines: list[str], font_size: int = 64, prefer_cjk: bool = True) -> bytes:
    """複数行テキストを白地・黒文字の PNG(bytes)として生成する。

    余白を広めに取り、大津二値化と OCR が安定するようにする。
    """
    font_path = find_cjk_font() if prefer_cjk else None
    if font_path is None:
        font_path = find_ascii_font()
    font = ImageFont.truetype(font_path, font_size)

    margin = 60
    line_gap = 30
    # 行サイズ計測。
    dummy = Image.new("RGB", (10, 10), "white")
    ddraw = ImageDraw.Draw(dummy)
    widths, heights = [], []
    for line in lines:
        box = ddraw.textbbox((0, 0), line, font=font)
        widths.append(box[2] - box[0])
        heights.append(box[3] - box[1])
    width = max(widths) + margin * 2
    height = sum(heights) + line_gap * (len(lines) - 1) + margin * 2

    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    y = margin
    for line, h in zip(lines, heights):
        draw.text((margin, y), line, fill="black", font=font)
        y += h + line_gap

    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def make_large_png(min_bytes: int) -> bytes:
    """指定バイト数を超える大きめ PNG を生成する(縮小経路のテスト用)。

    全面をランダムノイズで埋め(PNG 圧縮が効かず大容量になる)、中央に
    白背景の帯を置いて日付を可読状態で描画する。
    """
    import numpy as np

    size = 3000
    rng = np.random.default_rng(0)
    # 明るめ(170-255)のノイズ背景: PNG 圧縮が効かず大容量になりつつ、
    # 大津二値化では暗い文字のみが黒側に分離され OCR 可能。
    noise = rng.integers(170, 256, size=(size, size, 3), dtype=np.uint8)
    image = Image.fromarray(noise, mode="RGB")
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(find_ascii_font(), 260)
    # 白背景の帯 → その上に黒で日付を描き、ノイズに埋もれさせない。
    band_top, band_bottom = 1200, 1750
    draw.rectangle([150, band_top, size - 150, band_bottom], fill="white")
    draw.text((300, band_top + 90), "2026.12.31", fill="black", font=font)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    data = buffer.getvalue()
    if len(data) < min_bytes:
        raise AssertionError(f"生成画像が閾値未満です: {len(data)} < {min_bytes}")
    return data
