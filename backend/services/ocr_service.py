"""OCR 文字识别服务（可选）

使用 EasyOCR 对图片进行文字识别，辅助搜索。
可在设置中开启/关闭。
"""

import sys
import os
import io
import base64
import threading

_ocr_reader = None
_ocr_enabled = False
_ocr_lock = threading.Lock()
_ocr_ready = False
_OCR_FAILED_MSG = None


def _log(msg: str):
    print(f"[ocr_service] {msg}", file=sys.stderr, flush=True)


def _load_ocr():
    """延迟加载 EasyOCR（线程安全）"""
    global _ocr_reader, _ocr_ready, _OCR_FAILED_MSG

    if _ocr_ready:
        return
    if _OCR_FAILED_MSG is not None:
        raise RuntimeError(_OCR_FAILED_MSG)

    with _ocr_lock:
        if _ocr_ready:
            return
        if _OCR_FAILED_MSG is not None:
            raise RuntimeError(_OCR_FAILED_MSG)

        try:
            _log("Loading EasyOCR...")
            import easyocr
            _ocr_reader = easyocr.Reader(["en", "ch_sim"], gpu=False)
            _ocr_ready = True
            _log("EasyOCR loaded successfully")
        except ImportError:
            _OCR_FAILED_MSG = "EasyOCR not installed. Install with: pip install easyocr"
            _log(_OCR_FAILED_MSG)
            raise RuntimeError(_OCR_FAILED_MSG)
        except Exception as e:
            _OCR_FAILED_MSG = f"OCR load failed: {e}"
            _log(_OCR_FAILED_MSG)
            raise RuntimeError(_OCR_FAILED_MSG)


def _recognize_text(image_bytes: bytes) -> list:
    """识别图片中的文字，返回 [{text, confidence, bbox}]"""
    import numpy as np
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
    img_array = np.array(img)

    results = _ocr_reader.readtext(img_array)
    return [
        {"text": text, "confidence": round(conf, 4), "bbox": bbox}
        for bbox, text, conf in results
    ]


def execute(method: str, params: dict):
    if method == "ocr.recognize":
        return _handle_recognize(params)
    elif method == "ocr.getStatus":
        return _handle_get_status()
    elif method == "ocr.setEnabled":
        return _handle_set_enabled(params)
    else:
        raise ValueError(f"Unknown ocr method: {method}")


def _handle_recognize(params: dict):
    """识别图片文字"""
    global _ocr_enabled
    if not _ocr_enabled:
        return {"results": [], "enabled": False, "message": "OCR is disabled"}

    _load_ocr()

    image_b64 = params.get("image_base64", "")
    file_path = params.get("file_path", "")

    if image_b64:
        if "," in image_b64 and image_b64.startswith("data:"):
            image_b64 = image_b64.split(",", 1)[1]
        image_bytes = base64.b64decode(image_b64)
    elif file_path:
        if not os.path.exists(file_path):
            raise ValueError(f"File not found: {file_path}")
        with open(file_path, "rb") as f:
            image_bytes = f.read()
    else:
        raise ValueError("image_base64 or file_path required")

    results = _recognize_text(image_bytes)

    return {
        "results": results,
        "text": " ".join(r["text"] for r in results),
        "count": len(results),
    }


def _handle_get_status():
    return {
        "enabled": _ocr_enabled,
        "ready": _ocr_ready,
        "error": _OCR_FAILED_MSG,
    }


def _handle_set_enabled(params: dict):
    global _ocr_enabled
    _ocr_enabled = bool(params.get("enabled", False))
    return {"enabled": _ocr_enabled}
