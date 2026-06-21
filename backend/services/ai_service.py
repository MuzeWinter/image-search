"""AI 模型服务 — OpenCLIP ViT-B/32 特征提取

延迟加载模型，首次搜索时按需加载。
通过 stderr 输出加载进度供前端轮询。
"""

import sys
import json
import time
import threading
import io
import base64
import os

_model = None
_preprocess = None
_device = None
_load_lock = threading.Lock()
_load_progress = {"status": "idle", "percent": 0, "message": ""}
_LOAD_FAILED_MSG = None


def _log(msg: str):
    print(f"[ai_service] {msg}", file=sys.stderr, flush=True)


def _emit_progress(status: str, percent: int, message: str):
    global _load_progress
    _load_progress = {"status": status, "percent": percent, "message": message}
    payload = json.dumps({"type": "model-progress", "status": status, "percent": percent, "message": message}, ensure_ascii=False)
    # Write to a well-known temp file so the frontend can poll it
    tmpdir = os.environ.get("TEMP") or os.environ.get("TMP") or "/tmp"
    progress_file = os.path.join(tmpdir, "zoobet_model_progress.json")
    try:
        with open(progress_file, "w", encoding="utf-8") as f:
            f.write(payload)
    except Exception:
        pass


_LOAD_TIMEOUT_S = 120


def _load_model():
    """延迟加载 OpenCLIP ViT-B/32 模型（线程安全，带超时检测）"""
    global _model, _preprocess, _device, _LOAD_FAILED_MSG

    if _model is not None:
        return
    if _LOAD_FAILED_MSG is not None:
        raise RuntimeError(_LOAD_FAILED_MSG)

    with _load_lock:
        if _model is not None:
            return
        if _LOAD_FAILED_MSG is not None:
            raise RuntimeError(_LOAD_FAILED_MSG)

        load_result = {}

        def _do_load():
            try:
                _emit_progress("loading", 5, "Importing torch...")
                _log("Importing torch...")
                import torch
                dev = "cuda" if torch.cuda.is_available() else "cpu"
                _log(f"Using device: {dev}")

                _emit_progress("loading", 15, "Importing open_clip...")
                _log("Importing open_clip...")
                import open_clip

                _emit_progress("loading", 25, "Loading ViT-B/32 model...")
                _log("Loading OpenCLIP ViT-B/32...")
                m, _, prep = open_clip.create_model_and_transforms(
                    "ViT-B-32", pretrained="laion2b_s34b_b79k"
                )
                m = m.to(dev)
                m.eval()

                _emit_progress("loading", 80, "Loading tokenizer...")
                _log("Loading tokenizer...")
                import open_clip.tokenizer
                # Tokenizer is bundled, just verify it works
                open_clip.get_tokenizer("ViT-B-32")

                _emit_progress("ready", 100, "Model ready")
                _log("Model loaded successfully")
                load_result["ok"] = True
                load_result["model"] = m
                load_result["preprocess"] = prep
                load_result["device"] = dev
            except ImportError as e:
                load_result["error"] = f"Missing Python package: {e}. Install with: pip install open-clip-torch torch torchvision pillow"
            except Exception as e:
                load_result["error"] = f"Model load failed: {e}"

        t = threading.Thread(target=_do_load, daemon=True)
        t.start()
        t.join(timeout=_LOAD_TIMEOUT_S)

        if t.is_alive():
            _LOAD_FAILED_MSG = "模型加载超时"
            _emit_progress("error", 0, _LOAD_FAILED_MSG)
            _log(_LOAD_FAILED_MSG)
            raise RuntimeError(_LOAD_FAILED_MSG)

        if load_result.get("error"):
            _LOAD_FAILED_MSG = load_result["error"]
            _emit_progress("error", 0, _LOAD_FAILED_MSG)
            _log(_LOAD_FAILED_MSG)
            raise RuntimeError(_LOAD_FAILED_MSG)

        if load_result.get("ok"):
            _model = load_result["model"]
            _preprocess = load_result["preprocess"]
            _device = load_result["device"]


def _preprocess_image(image_data: bytes):
    """预处理图片：resize 224x224 center-crop + normalize"""
    from PIL import Image
    import torchvision.transforms as transforms

    img = Image.open(io.BytesIO(image_data))
    if img.mode != "RGB":
        img = img.convert("RGB")

    preprocess = transforms.Compose([
        transforms.Resize(224, interpolation=transforms.InterpolationMode.BICUBIC),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=(0.48145466, 0.4578275, 0.40821073),
            std=(0.26862954, 0.26130258, 0.27577711),
        ),
    ])
    return preprocess(img).unsqueeze(0)


def _extract_features(image_tensor):
    """提取特征向量"""
    import torch
    image_tensor = image_tensor.to(_device)
    with torch.no_grad():
        features = _model.encode_image(image_tensor)
        features = features / features.norm(dim=-1, keepdim=True)
    return features.cpu().numpy().flatten()


def _decode_base64_image(b64_string: str) -> bytes:
    """解码 base64 图片（支持 data:image/...;base64, 前缀）"""
    if "," in b64_string and b64_string.startswith("data:"):
        b64_string = b64_string.split(",", 1)[1]
    return base64.b64decode(b64_string)


def _handle_reset_model():
    global _LOAD_FAILED_MSG, _load_progress
    _LOAD_FAILED_MSG = None
    _load_progress = {"status": "idle", "percent": 0, "message": ""}
    _emit_progress("idle", 0, "")
    _log("Model state reset for retry")
    return {"ok": True}


def execute(method: str, params: dict):
    if method == "ai_search.loadModel":
        return _handle_load_model()
    elif method == "ai_search.getModelStatus":
        return _handle_get_model_status()
    elif method == "ai_search.extractFeatures":
        return _handle_extract_features(params)
    elif method == "ai_search.extractFeaturesFromPath":
        return _handle_extract_features_from_path(params)
    elif method == "ai_search.resetModel":
        return _handle_reset_model()
    else:
        raise ValueError(f"Unknown ai_search method: {method}")


def _handle_load_model():
    _load_model()
    return {
        "ok": True,
        "device": _device,
        "status": "ready",
    }


def _handle_get_model_status():
    return {
        "status": _load_progress["status"],
        "percent": _load_progress["percent"],
        "message": _load_progress["message"],
        "device": _device,
        "error": _LOAD_FAILED_MSG,
    }


def _handle_extract_features(params: dict):
    """从 base64 编码的图片提取特征向量"""
    image_b64 = params.get("image_base64", "")
    if not image_b64:
        raise ValueError("image_base64 is required")

    _load_model()
    image_bytes = _decode_base64_image(image_b64)
    tensor = _preprocess_image(image_bytes)
    vector = _extract_features(tensor)

    return {
        "vector": vector.tolist(),
        "dim": len(vector),
        "device": _device,
    }


def _handle_extract_features_from_path(params: dict):
    """从文件路径提取特征向量"""
    file_path = params.get("file_path", "")
    if not file_path:
        raise ValueError("file_path is required")
    if not os.path.exists(file_path):
        raise ValueError(f"File not found: {file_path}")

    _load_model()
    with open(file_path, "rb") as f:
        image_bytes = f.read()
    tensor = _preprocess_image(image_bytes)
    vector = _extract_features(tensor)

    return {
        "vector": vector.tolist(),
        "dim": len(vector),
        "device": _device,
        "file_path": file_path,
    }
