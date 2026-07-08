"""前処理関数の単体テスト。"""
from __future__ import annotations

import io

import numpy as np
import pytest
from PIL import Image

from app.config import get_settings
from app.preprocess import (
    InvalidImageError,
    decode_image,
    preprocess,
    resize_within_bounds,
    to_binary,
)


def _png_bytes(width: int, height: int) -> bytes:
    image = Image.new("RGB", (width, height), "white")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def test_decode_valid_image_returns_bgr_array():
    arr = decode_image(_png_bytes(120, 80))
    assert arr.ndim == 3
    assert arr.shape[2] == 3


def test_decode_empty_bytes_raises():
    with pytest.raises(InvalidImageError):
        decode_image(b"")


def test_decode_broken_bytes_raises():
    with pytest.raises(InvalidImageError):
        decode_image(b"this-is-not-an-image")


def test_resize_downscales_when_over_max():
    settings = get_settings()
    big = np.zeros((settings.max_image_dimension + 1500, 800, 3), dtype=np.uint8)
    out = resize_within_bounds(big, settings)
    assert max(out.shape[:2]) <= settings.max_image_dimension


def test_resize_upscales_when_below_min():
    settings = get_settings()
    small = np.zeros((100, 80, 3), dtype=np.uint8)
    out = resize_within_bounds(small, settings)
    assert max(out.shape[:2]) >= settings.min_image_dimension


def test_resize_keeps_within_bounds_unchanged():
    settings = get_settings()
    mid = max(settings.min_image_dimension, 1) + 10
    image = np.zeros((mid, mid, 3), dtype=np.uint8)
    out = resize_within_bounds(image, settings)
    assert out.shape == image.shape


def test_to_binary_returns_single_channel_binary():
    settings = get_settings()
    arr = decode_image(_png_bytes(200, 100))
    binary = to_binary(arr)
    assert binary.ndim == 2
    unique = set(np.unique(binary).tolist())
    assert unique.issubset({0, 255})


def test_preprocess_pipeline_returns_binary():
    settings = get_settings()
    binary = preprocess(_png_bytes(300, 200), settings)
    assert binary.ndim == 2
