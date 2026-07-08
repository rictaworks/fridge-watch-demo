"""OpenCV による OCR 前処理。

設計 1.6 F1 手順1-2:
- 5MB 超はサーバ側で縮小してから処理する。
- pytesseract に渡す前にグレースケール化・二値化・リサイズを行う。

フォールバック禁止方針に従い、デコード不能な入力は明示的に
InvalidImageError を送出する(呼び出し側が 400 に変換する)。
"""
from __future__ import annotations

import cv2
import numpy as np

from .config import Settings


class InvalidImageError(ValueError):
    """画像としてデコードできない入力を表す明示的な例外。"""


def decode_image(raw: bytes) -> np.ndarray:
    """バイト列を OpenCV 画像(BGR)へデコードする。

    デコード失敗時は握りつぶさず InvalidImageError を送出する。
    """
    if not raw:
        raise InvalidImageError("画像データが空です")
    buffer = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if image is None:
        raise InvalidImageError("画像をデコードできません(非対応形式または破損)")
    return image


def _scale_factor_for_bounds(height: int, width: int, settings: Settings) -> float:
    """長辺を min/max の範囲へ収めるための拡大縮小率を求める。"""
    longest = max(height, width)
    if longest > settings.max_image_dimension:
        return settings.max_image_dimension / float(longest)
    if longest < settings.min_image_dimension:
        return settings.min_image_dimension / float(longest)
    return 1.0


def resize_within_bounds(image: np.ndarray, settings: Settings) -> np.ndarray:
    """長辺を [min_image_dimension, max_image_dimension] に収める。

    設計 F1 手順1 の「縮小」に加え、精度確保のための最小サイズ拡大も担う。
    """
    height, width = image.shape[:2]
    if height == 0 or width == 0:
        raise InvalidImageError("画像サイズが不正です")
    factor = _scale_factor_for_bounds(height, width, settings)
    if factor == 1.0:
        return image
    new_size = (max(1, int(round(width * factor))), max(1, int(round(height * factor))))
    interpolation = cv2.INTER_AREA if factor < 1.0 else cv2.INTER_CUBIC
    return cv2.resize(image, new_size, interpolation=interpolation)


def to_binary(image: np.ndarray) -> np.ndarray:
    """グレースケール化 → 大津の二値化。二値画像(単チャネル)を返す。"""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    # 大津の自動閾値。パッケージ写真の照明ムラに一定の頑健性を持たせる。
    _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return binary


def preprocess(raw: bytes, settings: Settings) -> np.ndarray:
    """生バイト列 → OCR 入力用の二値画像。

    手順: デコード → 範囲内リサイズ → グレースケール二値化。
    """
    image = decode_image(raw)
    resized = resize_within_bounds(image, settings)
    return to_binary(resized)
