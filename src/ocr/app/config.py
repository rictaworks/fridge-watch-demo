"""OCR サービス設定。

設計方針(CLAUDE.md / code-style.md)に従い、文字列リテラル・閾値・
ポート等の設定値はここ(または環境変数)に集約し、ロジック側に
ハードコードしない。値はすべて環境変数で上書き可能とする。
"""
from __future__ import annotations

import os
from dataclasses import dataclass


def _get_int(name: str, default: int) -> int:
    """環境変数を整数として取得する。数値化できなければ明示的に例外を送出する。"""
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        return int(raw)
    except ValueError as exc:
        raise ValueError(f"環境変数 {name} は整数である必要があります: {raw!r}") from exc


def _get_str(name: str, default: str) -> str:
    value = os.environ.get(name, default)
    if not value:
        raise ValueError(f"環境変数 {name} は空にできません")
    return value


@dataclass(frozen=True)
class Settings:
    """OCR サービスの実行時設定。"""

    # OCR 言語。設計 1.6 F1: 日本語+英語。
    ocr_lang: str = _get_str("OCR_LANG", "jpn+eng")
    # tesseract 実行モード(--oem/--psm)。設定で調整可能にする。
    tesseract_config: str = _get_str("OCR_TESSERACT_CONFIG", "--oem 3 --psm 6")
    # 設計 1.6 F1 手順1: 5MB 超はサーバ側で縮小する。
    max_upload_bytes: int = _get_int("OCR_MAX_UPLOAD_BYTES", 5 * 1024 * 1024)
    # 縮小後に許容する最大長辺(ピクセル)。5MB 超画像のダウンサイズ目標。
    max_image_dimension: int = _get_int("OCR_MAX_IMAGE_DIMENSION", 2000)
    # OCR 精度確保のための最小長辺。小さすぎる画像は拡大する。
    min_image_dimension: int = _get_int("OCR_MIN_IMAGE_DIMENSION", 1000)
    # サービスポート。
    port: int = _get_int("OCR_PORT", 8001)
    # レスポンス lang フィールド既定値(= ocr_lang)。
    service_name: str = _get_str("OCR_SERVICE_NAME", "fridge-watch-ocr")


def get_settings() -> Settings:
    """設定インスタンスを生成する。テストでの差し替えを容易にするため関数化する。"""
    return Settings()
