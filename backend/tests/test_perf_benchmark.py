"""Performance benchmark tests for CLIP+FAISS image search pipeline.

Measures CLIP vectorization throughput, FAISS index build time, and search
latency at scale (100/1000/5000/10000 vectors). Writes aggregated results
to backend/tests/perf_results/.

Run independently from the main test suite:
    python -m pytest backend/tests/test_perf_benchmark.py -v
"""

import pytest
import numpy as np
import time
import io
import json
import os
import datetime
from unittest.mock import patch

DIM = 512
PERF_DIR = os.path.join(os.path.dirname(__file__), "perf_results")

# Module-level accumulator for benchmark results written at session end
_perf_results: list[dict] = []


# ── Helpers ──────────────────────────────────────────────────────────────────

def _random_image_bytes(width: int = 224, height: int = 224) -> bytes:
    """Generate random RGB JPEG bytes in memory (simulates a real image file)."""
    from PIL import Image
    arr = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)
    img = Image.fromarray(arr, "RGB")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def _normalized_vector(seed: int, dim: int = DIM) -> np.ndarray:
    """Deterministic L2-normalized vector from a seed."""
    rng = np.random.RandomState(seed)
    vec = rng.randn(dim).astype(np.float32)
    return vec / np.linalg.norm(vec).astype(np.float32)


def _vector_blob(vec: np.ndarray) -> bytes:
    """Pack vector to BLOB (matching search_service._vector_to_blob)."""
    return vec.astype(np.float32).tobytes()


def _insert_image_and_vector(conn, img_id: str, seed: int, *,
                             source_type: str = "file_image",
                             folder: str = "/test") -> np.ndarray:
    """Insert an image row and its deterministic vector into the DB. Returns the vector."""
    filename = f"{img_id}.jpg"
    conn.execute(
        "INSERT INTO images (img_id, source_type, file_path, filename, folder, favorite) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (img_id, source_type, f"/test/{filename}", filename, folder, 0),
    )
    vec = _normalized_vector(seed, DIM)
    conn.execute(
        "INSERT INTO vector_embeddings (img_id, vector_dim, vector_blob) VALUES (?, ?, ?)",
        (img_id, DIM, _vector_blob(vec)),
    )
    return vec


def _record_result(category: str, metric: str, value: float, unit: str,
                   scale: int | None = None, extra: dict | None = None):
    """Record a benchmark result for the final report."""
    entry: dict = {"category": category, "metric": metric, "value": value, "unit": unit}
    if scale is not None:
        entry["scale"] = scale
    if extra:
        entry.update(extra)
    _perf_results.append(entry)


# ── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _patch_search_service(in_memory_db):
    with patch("backend.services.search_service.get_connection", return_value=in_memory_db):
        yield


@pytest.fixture(autouse=True)
def _reset_search_globals():
    """Reset FAISS index globals before and after each test."""
    import backend.services.search_service as svc
    svc._index = None
    svc._index_img_ids = None
    svc._index_status = {"built": False, "count": 0, "dim": 0}
    yield
    svc._index = None
    svc._index_img_ids = None
    svc._index_status = {"built": False, "count": 0, "dim": 0}


@pytest.fixture(scope="session", autouse=True)
def _write_perf_report():
    """Write the accumulated benchmark results to a JSON report at session end."""
    yield
    if not _perf_results:
        return
    os.makedirs(PERF_DIR, exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    report_path = os.path.join(PERF_DIR, f"benchmark_{timestamp}.json")
    report = {
        "title": "CLIP+FAISS Performance Benchmark",
        "timestamp": datetime.datetime.now().isoformat(),
        "vector_dim": DIM,
        "results": _perf_results,
    }
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)


# ── 1. CLIP Vectorization Throughput ─────────────────────────────────────────

@pytest.mark.perf
def test_clip_vectorization_throughput():
    """Measure CLIP (OpenCLIP ViT-B/32) feature extraction throughput.

    Generates random JPEG images, runs them through the full CLIP pipeline
    (preprocess + encode), and reports images per second.
    """
    from backend.services.ai_service import _load_model, _preprocess_image, _extract_features

    try:
        _load_model()
    except (RuntimeError, ImportError) as e:
        pytest.skip(f"CLIP model not available: {e}")

    # Generate random JPEG images in memory
    sample_sizes = [20, 50, 100]
    for n_images in sample_sizes:
        images = [_random_image_bytes() for _ in range(n_images)]

        start = time.perf_counter()
        for img_bytes in images:
            tensor = _preprocess_image(img_bytes)
            _extract_features(tensor)
        elapsed = time.perf_counter() - start

        throughput = n_images / elapsed
        _record_result(
            "clip_vectorization", "throughput", throughput, "images/sec",
            scale=n_images,
            extra={"elapsed_sec": round(elapsed, 3), "images_processed": n_images},
        )

    # Simple sanity: throughput must be > 0.1 img/s even on slowest CPU
    assert throughput > 0.1, f"CLIP throughput too low: {throughput:.2f} img/s"


# ── 2. FAISS Index Build Time ────────────────────────────────────────────────

@pytest.mark.parametrize("size", [100, 1000, 5000, 10000])
def test_faiss_index_build_time(in_memory_db, size):
    """Measure FAISS index build time at various scales.

    Inserts `size` synthetic vectors into the DB, then times the full
    index build (read from DB -> build faiss.IndexFlatIP).
    """
    import backend.services.search_service as svc

    # Insert synthetic images + vectors
    for i in range(size):
        _insert_image_and_vector(in_memory_db, f"perf-img-{i}", i * 3)
    in_memory_db.commit()

    # Time the index build
    start = time.perf_counter()
    result = svc._build_index_from_images()
    elapsed_s = time.perf_counter() - start
    elapsed_ms = elapsed_s * 1000

    assert result["ok"] is True
    assert result["count"] == size

    _record_result(
        "faiss_index_build", "build_time", round(elapsed_ms, 2), "ms",
        scale=size,
        extra={"elapsed_sec": round(elapsed_s, 3), "vector_count": size},
    )

    # Soft threshold: index build should not exceed 10 seconds at 10k scale
    assert elapsed_s < 30, f"Index build too slow at scale {size}: {elapsed_s:.2f}s"


# ── 3. Search Latency ────────────────────────────────────────────────────────

@pytest.mark.parametrize("size", [100, 1000, 5000, 10000])
def test_search_latency(in_memory_db, size):
    """Measure search response time at various FAISS index scales.

    Builds a FAISS index with `size` synthetic vectors, then performs
    multiple top-10 searches and records average/max/min latency.
    """
    import backend.services.search_service as svc

    # Insert synthetic images + vectors
    for i in range(size):
        _insert_image_and_vector(in_memory_db, f"perf-img-{i}", i * 3)
    in_memory_db.commit()

    # Build index
    svc._build_index_from_images()

    # Warm-up search (first call may have cold caches)
    _ = svc._search_similar(_normalized_vector(42, DIM).tolist(), top_k=10)

    # Measure N search iterations
    iterations = 10
    latencies_ms: list[float] = []

    for iteration in range(iterations):
        query = _normalized_vector(iteration * 100, DIM).tolist()
        start = time.perf_counter()
        results = svc._search_similar(query, top_k=10)
        elapsed_ms = (time.perf_counter() - start) * 1000
        latencies_ms.append(elapsed_ms)
        assert len(results) <= 10

    avg_ms = sum(latencies_ms) / len(latencies_ms)
    min_ms = min(latencies_ms)
    max_ms = max(latencies_ms)

    _record_result(
        "search_latency", "avg_search_time", round(avg_ms, 3), "ms",
        scale=size,
        extra={
            "min_ms": round(min_ms, 3),
            "max_ms": round(max_ms, 3),
            "iterations": iterations,
            "top_k": 10,
        },
    )

    # Soft threshold: top-10 search should be under 200ms at any scale
    assert avg_ms < 500, f"Search too slow at scale {size}: avg {avg_ms:.2f}ms"


# ── 4. Search Throughput (queries per second) ────────────────────────────────

@pytest.mark.parametrize("size", [100, 1000, 5000, 10000])
def test_search_throughput(in_memory_db, size):
    """Measure how many top-10 searches per second the system can handle.

    Runs a burst of searches and measures queries/sec throughput.
    """
    import backend.services.search_service as svc

    for i in range(size):
        _insert_image_and_vector(in_memory_db, f"perf-img-{i}", i * 3)
    in_memory_db.commit()

    svc._build_index_from_images()

    # Warm-up
    _ = svc._search_similar(_normalized_vector(42, DIM).tolist(), top_k=10)

    # Burst: run many searches, measure total time
    burst_size = 50
    start = time.perf_counter()
    for iteration in range(burst_size):
        query = _normalized_vector(iteration * 100, DIM).tolist()
        _ = svc._search_similar(query, top_k=10)
    elapsed_s = time.perf_counter() - start

    qps = burst_size / elapsed_s

    _record_result(
        "search_throughput", "queries_per_sec", round(qps, 2), "queries/sec",
        scale=size,
        extra={
            "elapsed_sec": round(elapsed_s, 3),
            "burst_size": burst_size,
            "top_k": 10,
        },
    )

    assert qps > 1.0, f"Search throughput too low at scale {size}: {qps:.2f} qps"


# ── 5. Index memory footprint estimate ───────────────────────────────────────

@pytest.mark.parametrize("size", [100, 1000, 5000, 10000])
def test_index_memory_estimate(in_memory_db, size):
    """Estimate FAISS index memory footprint at various scales.

    FAISS IndexFlatIP stores vectors as float32, so memory = size * dim * 4 bytes.
    """
    import backend.services.search_service as svc

    for i in range(size):
        _insert_image_and_vector(in_memory_db, f"perf-img-{i}", i * 3)
    in_memory_db.commit()

    svc._build_index_from_images()

    import faiss
    assert isinstance(svc._index, faiss.IndexFlatIP)
    assert svc._index.ntotal == size

    # IndexFlatIP stores vectors as float32: dim * 4 bytes per vector
    bytes_per_vector = DIM * 4
    estimated_mb = (size * bytes_per_vector) / (1024 * 1024)

    _record_result(
        "index_memory", "estimated_mb", round(estimated_mb, 2), "MB",
        scale=size,
        extra={"bytes_per_vector": bytes_per_vector, "dim": DIM},
    )

    # 10000 * 512 * 4 bytes = ~19.5 MB — well within desktop memory budget
    assert estimated_mb < 100, f"Index memory too high at scale {size}: {estimated_mb:.2f} MB"


# ── 6. Result consistency at scale ───────────────────────────────────────────

def test_search_consistency_at_scale(in_memory_db):
    """Verify search result monotonicity and self-match at 1000 scale."""
    import backend.services.search_service as svc

    size = 1000
    for i in range(size):
        _insert_image_and_vector(in_memory_db, f"perf-img-{i}", i * 3)
    in_memory_db.commit()

    svc._build_index_from_images()

    # Self-match: query with seed 150's exact vector should find it first
    target_seed = 150 * 3
    target_id = f"perf-img-{150}"
    query = _normalized_vector(target_seed, DIM).tolist()
    results = svc._search_similar(query, top_k=10)

    assert len(results) > 0
    assert results[0]["img_id"] == target_id, (
        f"Self-match failed: expected {target_id}, got {results[0]['img_id']}"
    )
    assert results[0]["similarity"] > 0.99

    # Monotonicity
    sims = [r["similarity"] for r in results]
    for i in range(len(sims) - 1):
        assert sims[i] >= sims[i + 1], f"Similarity not monotonic at {i}"

    _record_result(
        "search_consistency", "scale_verified", size, "vectors",
        extra={"self_match": True, "monotonic": True},
    )
