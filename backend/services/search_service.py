"""FAISS 向量搜索服务

构建/更新 FAISS 索引、向量搜索、元数据反查、关联文件信息。
"""

import sys
import os
import json
import struct
import time
import threading
from typing import Any, cast

import numpy as np

from backend.db.connection import get_connection

_index: Any = None
_index_img_ids: list[str] | None = None
_index_lock = threading.Lock()
_index_status: dict[str, object] = {"built": False, "count": 0, "dim": 0}


def _log(msg: str):
    print(f"[search_service] {msg}", file=sys.stderr, flush=True)


def _add_activity_log(level: str, source: str, message: str):
    try:
        conn = get_connection()
        conn.execute(
            "INSERT INTO activity_logs (level, source, message) VALUES (?, ?, ?)",
            (level, source, message),
        )
        conn.commit()
    except Exception:
        pass


def _emit_progress(status: str, percent: int, message: str):
    payload = json.dumps({"type": "index-progress", "status": status, "percent": percent, "message": message}, ensure_ascii=False)
    tmpdir = os.environ.get("TEMP") or os.environ.get("TMP") or "/tmp"
    progress_file = os.path.join(tmpdir, "zoobet_index_progress.json")
    try:
        with open(progress_file, "w", encoding="utf-8") as f:
            f.write(payload)
    except Exception:
        pass


def _vector_to_blob(vec: np.ndarray) -> bytes:
    """将 numpy 向量打包为 BLOB"""
    return vec.astype(np.float32).tobytes()


def _blob_to_vector(blob: bytes, dim: int) -> np.ndarray:
    """从 BLOB 解包为 numpy 向量"""
    return np.frombuffer(blob, dtype=np.float32).reshape(-1, dim)


def _load_index():
    """加载或构建 FAISS 索引"""
    global _index, _index_img_ids, _index_status

    if _index is not None and _index_status["built"]:
        return

    with _index_lock:
        if _index is not None and _index_status["built"]:
            return

        try:
            import faiss
        except ImportError:
            raise RuntimeError(
                "FAISS not installed. Install with: pip install faiss-cpu"
            )

        _emit_progress("building", 0, "Reading embeddings from database...")
        _log("Building FAISS index from database...")

        conn = get_connection()
        rows = conn.execute(
            "SELECT img_id, vector_dim, vector_blob FROM vector_embeddings"
        ).fetchall()

        if not rows:
            _log("No embeddings in database, creating empty index")
            _index = faiss.IndexFlatIP(512)
            _index_img_ids = []
            _index_status = {"built": True, "count": 0, "dim": 512}
            _emit_progress("ready", 100, "Index ready (empty)")
            return

        total = len(rows)
        dim = rows[0]["vector_dim"]

        _emit_progress("building", 10, f"Loading {total} vectors...")
        vectors = np.zeros((total, dim), dtype=np.float32)
        img_ids = []

        for i, row in enumerate(rows):
            try:
                vec = _blob_to_vector(row["vector_blob"], dim)
                vectors[i] = vec[0]
                img_ids.append(row["img_id"])
            except Exception as e:
                _log(f"Skip corrupted vector for {row['img_id']}: {e}")
                continue

            if i % 100 == 0:
                pct = 10 + int(70 * i / total)
                _emit_progress("building", pct, f"Loading vectors {i}/{total}...")

        # Use inner product (cosine similarity for normalized vectors)
        _emit_progress("building", 85, "Building FAISS index...")
        _index = faiss.IndexFlatIP(dim)
        _index.add(vectors[:len(img_ids)])
        _index_img_ids = img_ids
        _index_status = {"built": True, "count": len(img_ids), "dim": dim}

        _emit_progress("ready", 100, f"Index ready with {len(img_ids)} vectors")
        _log(f"FAISS index built: {len(img_ids)} vectors, dim={dim}")


def _index_single(img_id: str, vector: list):
    """将单个向量加入索引"""
    global _index, _index_img_ids, _index_status

    import faiss

    vec = np.array(vector, dtype=np.float32).reshape(1, -1)
    dim = vec.shape[1]

    # Store in DB
    conn = get_connection()
    blob = _vector_to_blob(vec)
    conn.execute(
        "INSERT OR REPLACE INTO vector_embeddings (img_id, vector_dim, vector_blob) VALUES (?, ?, ?)",
        (img_id, dim, blob),
    )
    conn.commit()

    # Add to FAISS index
    with _index_lock:
        if _index is None:
            _index = faiss.IndexFlatIP(dim)
            _index_img_ids = []
            _index_status["dim"] = dim

        img_ids = _index_img_ids
        assert img_ids is not None
        _index.add(vec)
        img_ids.append(img_id)
        _index_status["count"] = len(img_ids)
        _index_status["built"] = True

    assert _index_img_ids is not None
    _log(f"Indexed image {img_id}, total={len(_index_img_ids)}")


def _search_similar(query_vector: list, top_k: int = 20, scope: str = "all", library_id: int | None = None):
    """搜索相似图片，支持搜索范围过滤和资料库过滤"""
    _load_index()

    if _index is None or _index_img_ids is None:
        _log("Index or img_ids not initialized, returning empty")
        return []

    if _index_status["count"] == 0:
        return []

    vec = np.array(query_vector, dtype=np.float32).reshape(1, -1)

    # Get more candidates to filter by scope
    fetch_k = min(top_k * 3, cast(int, _index_status["count"]))

    if _index is None or _index_img_ids is None:
        return []
    distances, indices = _index.search(vec, fetch_k)

    results = []
    conn = get_connection()

    # Resolve library path if filtering by library
    library_path = None
    if library_id is not None:
        lib_row = conn.execute(
            "SELECT path FROM libraries WHERE id = ?", (library_id,)
        ).fetchone()
        if lib_row is None:
            _log(f"Library not found: {library_id}")
            return []
        library_path = lib_row["path"].replace("\\", "/").rstrip("/") + "/"

    for dist, idx in zip(distances[0], indices[0]):
        if idx < 0 or idx >= len(_index_img_ids):
            continue
        img_id = _index_img_ids[idx]

        # Query image metadata
        img_row = conn.execute(
            "SELECT * FROM images WHERE img_id = ?", (img_id,)
        ).fetchone()
        if img_row is None:
            continue

        img_data = dict(img_row)

        # Apply library filter (by folder path prefix)
        if library_path is not None:
            img_folder = (img_data.get("folder") or "").replace("\\", "/")
            if not (img_folder + "/").startswith(library_path):
                continue

        # Apply scope filter
        if scope == "excel_only" and img_data.get("source_type") != "excel_embedded":
            continue
        if scope == "images_only" and img_data.get("source_type") != "file_image":
            continue
        if scope == "with_cad":
            cad_ref = img_data.get("cad_ref")
            if not cad_ref:
                # Also check matches table
                match_row = conn.execute(
                    "SELECT cad_id FROM matches WHERE img_id = ? AND cad_id IS NOT NULL LIMIT 1",
                    (img_id,)
                ).fetchone()
                if not match_row:
                    continue
        if scope == "favorites_only" and not img_data.get("favorite"):
            continue

        # Parse tags
        tags_str = img_data.get("tags") or ""
        img_data["tags"] = [t.strip() for t in tags_str.split(",") if t.strip()]

        # Associate Excel info
        ex_ref = img_data.get("ex_ref")
        excel_info = None
        if ex_ref:
            ex_row = conn.execute(
                "SELECT ex_id, file_path, filename, sheet_name, row_number, column_name, cell_value FROM excel_records WHERE ex_id = ?",
                (ex_ref,),
            ).fetchone()
            if ex_row:
                excel_info = dict(ex_row)

        # Associate CAD info
        cad_ref = img_data.get("cad_ref")
        cad_info = None
        if cad_ref:
            cad_row = conn.execute(
                "SELECT cad_id, file_path, filename, extension FROM cad_files WHERE cad_id = ?",
                (cad_ref,),
            ).fetchone()
            if cad_row:
                cad_info = dict(cad_row)

        # Associate PDF info
        pdf_ref = img_data.get("pdf_ref")
        pdf_info = None
        if pdf_ref:
            pdf_row = conn.execute(
                "SELECT doc_id, file_path, filename, page_count FROM pdf_files WHERE doc_id = ?",
                (pdf_ref,),
            ).fetchone()
            if pdf_row:
                pdf_info = dict(pdf_row)

        results.append({
            "img_id": img_data["img_id"],
            "source_type": img_data["source_type"],
            "file_path": img_data["file_path"],
            "image_path": img_data.get("image_path"),
            "origin_path": img_data.get("origin_path"),
            "folder": img_data.get("folder"),
            "filename": img_data.get("filename"),
            "size_bytes": img_data.get("size_bytes"),
            "width": img_data.get("width"),
            "height": img_data.get("height"),
            "format": os.path.splitext(img_data.get("filename") or img_data.get("file_path") or "")[1].upper().lstrip("."),
            "tags": img_data["tags"],
            "favorite": bool(img_data.get("favorite")),
            "similarity": float(dist),
            "sheet_name": img_data.get("sheet_name"),
            "row_number": img_data.get("row_number"),
            "ug_ref": img_data.get("ug_ref"),
            "ocr_text": img_data.get("ocr_text") or "",
            "ex_ref": ex_ref,
            "excel_info": excel_info,
            "cad_ref": cad_ref,
            "cad_info": cad_info,
            "pdf_ref": pdf_ref,
            "pdf_info": pdf_info,
        })

    return results


def _build_index_from_images():
    """从 images 表批量构建向量索引（需要已提取向量的图片）"""
    _emit_progress("building", 0, "Reading embeddings...")

    conn = get_connection()
    rows = conn.execute(
        "SELECT img_id, vector_dim, vector_blob FROM vector_embeddings"
    ).fetchall()

    if not rows:
        _emit_progress("ready", 100, "No embeddings to index")
        return {"ok": True, "count": 0, "message": "No embeddings in database"}

    import faiss
    total = len(rows)
    dim = rows[0]["vector_dim"]

    vectors = np.zeros((total, dim), dtype=np.float32)
    img_ids = []

    for i, row in enumerate(rows):
        try:
            vec = _blob_to_vector(row["vector_blob"], dim)
            vectors[i] = vec[0]
            img_ids.append(row["img_id"])
        except Exception as e:
            _log(f"Skip corrupted vector for {row['img_id']}: {e}")
            continue

        if i % 200 == 0:
            pct = int(90 * i / total)
            _emit_progress("building", pct, f"Building index {i}/{total}...")

    with _index_lock:
        global _index, _index_img_ids, _index_status
        _index = faiss.IndexFlatIP(dim)
        _index.add(vectors[:len(img_ids)])
        _index_img_ids = img_ids
        _index_status = {"built": True, "count": len(img_ids), "dim": dim}

    _emit_progress("ready", 100, f"Index built with {len(img_ids)} vectors")
    _log(f"FAISS index rebuilt: {len(img_ids)} vectors")

    return {"ok": True, "count": len(img_ids), "dim": dim}


def execute(method: str, params: dict):
    if method == "search.buildIndex":
        return _build_index_from_images()
    elif method == "search.rebuildIndex":
        return _build_index_from_images()
    elif method == "search.searchByVector":
        return _handle_search_by_vector(params)
    elif method == "search.searchByImage":
        return _handle_search_by_image(params)
    elif method == "search.searchByPath":
        return _handle_search_by_path(params)
    elif method == "search.indexImage":
        return _handle_index_image(params)
    elif method == "search.getIndexStatus":
        return {
            "built": _index_status["built"],
            "count": _index_status["count"],
            "dim": _index_status["dim"],
        }
    elif method == "search.modelStatus":
        return _handle_model_status()
    elif method == "search.resetModel":
        return _handle_reset_model()
    elif method == "search.listEmbeddings":
        return _handle_list_embeddings(params)
    elif method == "search.deleteEmbedding":
        return _handle_delete_embedding(params)
    elif method == "search.batchIndex":
        return _handle_batch_index(params)
    else:
        raise ValueError(f"Unknown search method: {method}")


def _handle_search_by_vector(params: dict):
    """通过特征向量搜索相似图片"""
    vector = params.get("vector", [])
    top_k = params.get("top_k", 20)
    scope = params.get("scope", "all")
    library_id = params.get("library_id")
    if not vector:
        raise ValueError("vector is required")

    start = time.time()
    results = _search_similar(vector, top_k, scope, library_id)
    duration_ms = int((time.time() - start) * 1000)

    _add_activity_log("info", "search", f"Vector search: {len(results)} results in {duration_ms}ms (scope={scope})")

    return {
        "results": results,
        "count": len(results),
        "duration_ms": duration_ms,
    }


def _handle_search_by_image(params: dict):
    """通过 base64 图片搜索相似图片"""
    import base64
    import io

    image_b64 = params.get("image_base64", "")
    if not image_b64:
        raise ValueError("image_base64 is required")
    top_k = params.get("top_k", 20)
    scope = params.get("scope", "all")
    library_id = params.get("library_id")

    # Decode image
    if "," in image_b64 and image_b64.startswith("data:"):
        image_b64 = image_b64.split(",", 1)[1]
    image_bytes = base64.b64decode(image_b64)

    # Extract features using ai_service
    from backend.services.ai_service import _load_model, _preprocess_image, _extract_features

    try:
        _load_model()
    except Exception as e:
        raise RuntimeError(f"Model not available: {e}")

    tensor = _preprocess_image(image_bytes)
    vector = _extract_features(tensor)

    # Search
    start = time.time()
    results = _search_similar(vector.tolist(), top_k, scope, library_id)
    duration_ms = int((time.time() - start) * 1000)

    # Record search history
    try:
        conn = get_connection()
        conn.execute(
            "INSERT INTO search_history (query_image, result_count, duration_ms) VALUES (?, ?, ?)",
            ("query_image", len(results), duration_ms),
        )
        conn.commit()
    except Exception:
        pass

    _add_activity_log("info", "search", f"Image search: {len(results)} results in {duration_ms}ms")

    return {
        "results": results,
        "count": len(results),
        "duration_ms": duration_ms,
        "query_vector_dim": len(vector),
    }


def _handle_search_by_path(params: dict):
    """通过图片文件路径搜索相似图片"""
    file_path = params.get("file_path", "")
    if not file_path:
        raise ValueError("file_path is required")
    if not os.path.exists(file_path):
        raise ValueError(f"File not found: {file_path}")
    top_k = params.get("top_k", 20)
    scope = params.get("scope", "all")
    library_id = params.get("library_id")

    with open(file_path, "rb") as f:
        image_bytes = f.read()

    from backend.services.ai_service import _load_model, _preprocess_image, _extract_features

    try:
        _load_model()
    except Exception as e:
        raise RuntimeError(f"Model not available: {e}")

    tensor = _preprocess_image(image_bytes)
    vector = _extract_features(tensor)

    start = time.time()
    results = _search_similar(vector.tolist(), top_k, scope, library_id)
    duration_ms = int((time.time() - start) * 1000)

    # Record search history
    try:
        conn = get_connection()
        conn.execute(
            "INSERT INTO search_history (query_image, result_count, duration_ms) VALUES (?, ?, ?)",
            (os.path.basename(file_path), len(results), duration_ms),
        )
        conn.commit()
    except Exception:
        pass

    _add_activity_log("info", "search", f"Path search: {os.path.basename(file_path)} — {len(results)} results in {duration_ms}ms")

    return {
        "results": results,
        "count": len(results),
        "duration_ms": duration_ms,
        "query_file": file_path,
    }


def _handle_index_image(params: dict):
    """索引单张图片（提取特征 + 存储向量 + 加入 FAISS）"""
    img_id = params.get("img_id", "")
    if not img_id:
        raise ValueError("img_id is required")

    use_base64 = "image_base64" in params
    from backend.services.ai_service import _load_model, _preprocess_image, _extract_features

    try:
        _load_model()
    except Exception as e:
        raise RuntimeError(f"Model not available: {e}")

    import base64
    if use_base64:
        image_b64 = params["image_base64"]
        if "," in image_b64 and image_b64.startswith("data:"):
            image_b64 = image_b64.split(",", 1)[1]
        image_bytes = base64.b64decode(image_b64)
    else:
        file_path = params.get("file_path", "")
        if not file_path or not os.path.exists(file_path):
            raise ValueError(f"file_path required and must exist")
        with open(file_path, "rb") as f:
            image_bytes = f.read()

    tensor = _preprocess_image(image_bytes)
    vector = _extract_features(tensor)

    _index_single(img_id, vector.tolist())

    return {
        "ok": True,
        "img_id": img_id,
        "vector_dim": len(vector),
    }


def _handle_list_embeddings(params: dict):
    """列出已索引的向量"""
    limit = params.get("limit", 100)
    offset = params.get("offset", 0)
    conn = get_connection()
    rows = conn.execute(
        "SELECT ve.id, ve.img_id, ve.vector_dim, ve.created_at, i.filename, i.source_type "
        "FROM vector_embeddings ve LEFT JOIN images i ON ve.img_id = i.img_id "
        "ORDER BY ve.id DESC LIMIT ? OFFSET ?",
        (limit, offset),
    ).fetchall()
    total = conn.execute("SELECT COUNT(*) as n FROM vector_embeddings").fetchone()["n"]
    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def _handle_delete_embedding(params: dict):
    """删除指定图片的向量（需要重建索引才能生效）"""
    img_id = params.get("img_id", "")
    if not img_id:
        raise ValueError("img_id is required")
    conn = get_connection()
    conn.execute("DELETE FROM vector_embeddings WHERE img_id = ?", (img_id,))
    conn.commit()
    # Invalidate index to force rebuild
    global _index, _index_img_ids, _index_status
    with _index_lock:
        _index = None
        _index_img_ids = None
        _index_status = {"built": False, "count": 0, "dim": 0}
    return {"ok": True, "deleted": img_id}


def _handle_batch_index(params: dict):
    """批量索引图片（从 images 表中读取未索引的图片）"""
    limit = params.get("limit", 50)
    conn = get_connection()

    # Find images without embeddings
    rows = conn.execute(
        "SELECT i.img_id, i.file_path FROM images i "
        "LEFT JOIN vector_embeddings ve ON i.img_id = ve.img_id "
        "WHERE ve.img_id IS NULL "
        "LIMIT ?",
        (limit,),
    ).fetchall()

    from backend.services.ai_service import _load_model, _preprocess_image, _extract_features

    try:
        _load_model()
    except Exception as e:
        raise RuntimeError(f"Model not available: {e}")

    indexed = 0
    errors = []

    for row in rows:
        img_id = row["img_id"]
        file_path = row["file_path"]
        try:
            if not os.path.exists(file_path):
                errors.append({"img_id": img_id, "error": f"File not found: {file_path}"})
                continue
            with open(file_path, "rb") as f:
                image_bytes = f.read()
            tensor = _preprocess_image(image_bytes)
            vector = _extract_features(tensor)
            _index_single(img_id, vector.tolist())
            indexed += 1
        except Exception as e:
            errors.append({"img_id": img_id, "error": str(e)})
            _log(f"Failed to index {img_id}: {e}")

    _emit_progress("ready", 100, f"Batch index done: {indexed} indexed, {len(errors)} errors")

    return {
        "ok": True,
        "indexed": indexed,
        "errors": errors,
        "total_checked": len(rows),
    }


def _handle_model_status():
    """查询 AI 模型加载进度（委托给 ai_service 的内部状态）"""
    from backend.services.ai_service import _load_progress, _device, _LOAD_FAILED_MSG

    return {
        "status": _load_progress["status"],
        "percent": _load_progress["percent"],
        "message": _load_progress["message"],
        "device": _device,
        "error": _LOAD_FAILED_MSG,
    }


def _handle_reset_model():
    """重置 AI 模型失败状态以支持手动重试"""
    from backend.services.ai_service import _handle_reset_model as _ai_reset
    return _ai_reset()
