"""pytesseract を用いた文字抽出。

設計 1.6 F1 手順2 の「文字抽出」までを担当する。日付候補抽出・
カテゴリ判定はバックエンド(Rails)側の責務のため、本サービスは
抽出全文のみを返す。
"""
from __future__ import annotations

import logging

import numpy as np
import pytesseract

from .config import Settings

logger = logging.getLogger("ocr.extract")


class OcrExtractionError(RuntimeError):
    """tesseract 実行そのものが失敗したことを表す明示的な例外。"""


def extract_text(binary_image: np.ndarray, settings: Settings) -> str:
    """前処理済み画像から日本語+英語の文字列を抽出する。

    tesseract の実行失敗は握りつぶさず OcrExtractionError に変換する。
    文字が読めず空文字が返る場合は正常系(呼び出し側で完全失敗を判断)。
    """
    try:
        text = pytesseract.image_to_string(
            binary_image,
            lang=settings.ocr_lang,
            config=settings.tesseract_config,
        )
    except pytesseract.TesseractNotFoundError as exc:
        logger.error("tesseract 実行ファイルが見つかりません", exc_info=True)
        raise OcrExtractionError("tesseract がインストールされていません") from exc
    except pytesseract.TesseractError as exc:
        logger.error("tesseract 実行エラー: status=%s", getattr(exc, "status", "?"), exc_info=True)
        raise OcrExtractionError("OCR エンジンの実行に失敗しました") from exc
    return text
