"""FastAPI アプリ本体。

エンドポイント:
- POST /ocr    : 画像1枚(multipart)を受け取り抽出全文を返す。
- GET  /health : 死活監視。

設計方針: フォールバック禁止。壊れた画像は 400、OCR エンジン障害は
503 を返し、例外を握りつぶさない。構造化ログ(JSON 風の key=value)を出す。
"""
from __future__ import annotations

import logging
import uuid

from fastapi import Depends, FastAPI, File, UploadFile
from fastapi.responses import JSONResponse

from .config import Settings, get_settings
from .ocr import OcrExtractionError, extract_text
from .preprocess import InvalidImageError, preprocess

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s level=%(levelname)s logger=%(name)s %(message)s",
)
logger = logging.getLogger("ocr.api")

app = FastAPI(title="fridge-watch-ocr", version="1.0.0")


@app.get("/health")
def health(settings: Settings = Depends(get_settings)) -> dict:
    """死活監視。サービス名と OCR 言語を返す。"""
    return {"status": "ok", "service": settings.service_name, "lang": settings.ocr_lang}


@app.post("/ocr")
async def ocr(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
) -> JSONResponse:
    """画像から文字を抽出して返す。

    レスポンス: {"text": "<抽出全文>", "lang": "jpn+eng"}
    """
    trace_id = uuid.uuid4().hex[:12]
    raw = await file.read()
    size = len(raw)
    logger.info(
        "trace_id=%s event=ocr_request filename=%s content_type=%s bytes=%d",
        trace_id, file.filename, file.content_type, size,
    )

    # 設計 F1 手順1: 5MB 超はサーバ側で縮小する(縮小は preprocess の
    # 長辺上限で実施)。ここでは検知をログに残す。
    if size > settings.max_upload_bytes:
        logger.info(
            "trace_id=%s event=oversize_downscale bytes=%d limit=%d",
            trace_id, size, settings.max_upload_bytes,
        )

    try:
        binary_image = preprocess(raw, settings)
    except InvalidImageError as exc:
        logger.warning("trace_id=%s event=invalid_image reason=%s", trace_id, exc)
        return JSONResponse(status_code=400, content={"error": str(exc), "trace_id": trace_id})

    try:
        text = extract_text(binary_image, settings)
    except OcrExtractionError as exc:
        logger.error("trace_id=%s event=ocr_engine_error reason=%s", trace_id, exc)
        return JSONResponse(status_code=503, content={"error": str(exc), "trace_id": trace_id})

    logger.info("trace_id=%s event=ocr_success chars=%d", trace_id, len(text))
    return JSONResponse(status_code=200, content={"text": text, "lang": settings.ocr_lang})
