"""End-to-end tests for CLIP+FAISS image search pipeline.

Tests the full pipeline: index building → vector extraction → FAISS search →
result ranking, plus scope filtering, empty index, and top_k truncation.
Uses real FAISS with deterministic synthetic vectors.
"""

import pytest
import numpy as np
from unittest.mock import patch


DIM = 512


# ── Helpers ────────────────────────────────────────────────────────────────

def _normalized_vector(seed: int, dim: int = DIM) -> np.ndarray:
    """Generate a deterministic L2-normalized vector from a seed."""
    rng = np.random.RandomState(seed)
    vec = rng.randn(dim).astype(np.float32)
    return vec / np.linalg.norm(vec).astype(np.float32)


def _vector_blob(vec: np.ndarray) -> bytes:
    """Pack vector to BLOB (matching search_service._vector_to_blob)."""
    return vec.astype(np.float32).tobytes()


def _insert_image_and_vector(conn, img_id: str, seed: int, *,
                             source_type: str = "file_image",
                             folder: str = "/test",
                             favorite: int = 0):
    """Insert an image row and its deterministic vector into the DB."""
    filename = f"{img_id}.jpg"
    conn.execute(
        "INSERT INTO images (img_id, source_type, file_path, filename, folder, favorite) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (img_id, source_type, f"/test/{filename}", filename, folder, favorite),
    )
    vec = _normalized_vector(seed, DIM)
    conn.execute(
        "INSERT INTO vector_embeddings (img_id, vector_dim, vector_blob) VALUES (?, ?, ?)",
        (img_id, DIM, _vector_blob(vec)),
    )
    return vec


# ── Shared fixtures ────────────────────────────────────────────────────────

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


# ── 1. Full pipeline: index build → search → result ranking ────────────────

def test_full_pipeline_with_five_images(in_memory_db):
    """Insert 5 images with vectors, build FAISS index, search, verify results."""
    import backend.services.search_service as svc
    from backend.services.search_service import execute

    seeds = [0, 100, 200, 300, 400]
    img_ids = ["img-red", "img-green", "img-blue", "img-yellow", "img-black"]

    for img_id, seed in zip(img_ids, seeds):
        _insert_image_and_vector(in_memory_db, img_id, seed)
    in_memory_db.commit()

    # Build real FAISS index from DB
    result = execute("search.buildIndex", {})
    assert result["ok"] is True
    assert result["count"] == 5
    assert result["dim"] == DIM

    # Verify index globals are set
    assert svc._index is not None
    assert svc._index_status["built"] is True
    assert svc._index_status["count"] == 5

    # Search with vector close to img-red (seed=0)
    query = _normalized_vector(0, DIM).tolist()
    search_result = execute("search.searchByVector", {
        "vector": query, "top_k": 10,
    })

    assert search_result["count"] == 5
    assert len(search_result["results"]) == 5
    assert "duration_ms" in search_result

    # Results should be ranked by similarity descending
    sims = [r["similarity"] for r in search_result["results"]]
    for i in range(len(sims) - 1):
        assert sims[i] >= sims[i + 1], f"Similarity not monotonic: {sims[i]} < {sims[i + 1]}"

    # Each result must have required fields
    for r in search_result["results"]:
        assert "img_id" in r
        assert "similarity" in r
        assert "source_type" in r
        assert "file_path" in r
        assert "filename" in r


# ── 2. Similarity monotonicity — self-search highest ───────────────────────

def test_self_search_returns_highest_similarity(in_memory_db):
    """Querying with a known vector returns its own image first with max score."""
    from backend.services.search_service import execute

    seeds = [10, 110, 210, 310, 410]
    img_ids = [f"img-{i}" for i in range(5)]
    vectors = {}

    for img_id, seed in zip(img_ids, seeds):
        vectors[img_id] = _insert_image_and_vector(in_memory_db, img_id, seed)
    in_memory_db.commit()

    execute("search.buildIndex", {})

    # Search with img-2's exact vector
    target_id = "img-2"
    query = vectors[target_id].tolist()
    result = execute("search.searchByVector", {"vector": query, "top_k": 10})

    assert result["count"] == 5
    top = result["results"][0]
    assert top["img_id"] == target_id, (
        f"Expected {target_id} first, got {top['img_id']}"
    )
    # Self-similarity should be ~1.0 (cosine similarity of identical normalized vectors)
    assert top["similarity"] > 0.99, f"Self-similarity too low: {top['similarity']}"

    # All successive similarities must be <= previous
    sims = [r["similarity"] for r in result["results"]]
    for i in range(len(sims) - 1):
        assert sims[i] >= sims[i + 1], (
            f"Similarity not monotonic at {i}: {sims[i]} < {sims[i + 1]}"
        )


def test_different_query_finds_different_top_result(in_memory_db):
    """Each distinct query vector returns its closest match first."""
    from backend.services.search_service import execute

    seeds = [50, 150, 250, 350, 450]
    img_ids = [f"cat-{i}" for i in range(5)]
    vectors = {}

    for img_id, seed in zip(img_ids, seeds):
        vectors[img_id] = _insert_image_and_vector(in_memory_db, img_id, seed)
    in_memory_db.commit()

    execute("search.buildIndex", {})

    # Search with each vector — should find itself first
    for target_id in img_ids:
        query = vectors[target_id].tolist()
        result = execute("search.searchByVector", {"vector": query, "top_k": 5})
        assert result["results"][0]["img_id"] == target_id


# ── 3. Scope filter tests ─────────────────────────────────────────────────

def test_scope_images_only_filters_correctly(in_memory_db):
    """scope=images_only excludes excel_embedded and ug-preview images."""
    from backend.services.search_service import execute

    # Mix of source types
    _insert_image_and_vector(in_memory_db, "img-file", 60, source_type="file_image")
    _insert_image_and_vector(in_memory_db, "img-excel", 160, source_type="excel_embedded")
    _insert_image_and_vector(in_memory_db, "img-ug", 260, source_type="ug-preview")
    _insert_image_and_vector(in_memory_db, "img-file2", 360, source_type="file_image")
    in_memory_db.commit()

    execute("search.buildIndex", {})

    result = execute("search.searchByVector", {
        "vector": _normalized_vector(60, DIM).tolist(),
        "top_k": 10,
        "scope": "images_only",
    })

    assert result["count"] == 2
    ids = {r["img_id"] for r in result["results"]}
    assert ids == {"img-file", "img-file2"}


def test_scope_excel_only_filters_correctly(in_memory_db):
    """scope=excel_only only returns excel_embedded images."""
    from backend.services.search_service import execute

    _insert_image_and_vector(in_memory_db, "img-file", 70, source_type="file_image")
    _insert_image_and_vector(in_memory_db, "img-excel", 170, source_type="excel_embedded")
    _insert_image_and_vector(in_memory_db, "img-excel2", 270, source_type="excel_embedded")
    _insert_image_and_vector(in_memory_db, "img-file2", 370, source_type="file_image")
    in_memory_db.commit()

    execute("search.buildIndex", {})

    result = execute("search.searchByVector", {
        "vector": _normalized_vector(170, DIM).tolist(),
        "top_k": 10,
        "scope": "excel_only",
    })

    assert result["count"] == 2
    ids = {r["img_id"] for r in result["results"]}
    assert ids == {"img-excel", "img-excel2"}


def test_scope_favorites_only_filters_correctly(in_memory_db):
    """scope=favorites_only only returns favorited images."""
    from backend.services.search_service import execute

    _insert_image_and_vector(in_memory_db, "img-fav", 80, favorite=1)
    _insert_image_and_vector(in_memory_db, "img-norm", 180, favorite=0)
    _insert_image_and_vector(in_memory_db, "img-fav2", 280, favorite=1)
    _insert_image_and_vector(in_memory_db, "img-norm2", 380, favorite=0)
    in_memory_db.commit()

    execute("search.buildIndex", {})

    result = execute("search.searchByVector", {
        "vector": _normalized_vector(80, DIM).tolist(),
        "top_k": 10,
        "scope": "favorites_only",
    })

    assert result["count"] == 2
    ids = {r["img_id"] for r in result["results"]}
    assert ids == {"img-fav", "img-fav2"}


def test_scope_all_returns_everything(in_memory_db):
    """scope=all (default) returns all source types."""
    from backend.services.search_service import execute

    _insert_image_and_vector(in_memory_db, "img-file", 90, source_type="file_image")
    _insert_image_and_vector(in_memory_db, "img-excel", 190, source_type="excel_embedded")
    _insert_image_and_vector(in_memory_db, "img-ug", 290, source_type="ug-preview")
    in_memory_db.commit()

    execute("search.buildIndex", {})

    result = execute("search.searchByVector", {
        "vector": _normalized_vector(90, DIM).tolist(),
        "top_k": 10,
        "scope": "all",
    })

    assert result["count"] == 3


# ── 4. Empty index graceful handling ──────────────────────────────────────

def test_empty_index_search_returns_empty(in_memory_db):
    """Search with no vectors in DB returns empty results without error."""
    from backend.services.search_service import execute

    result = execute("search.searchByVector", {
        "vector": _normalized_vector(0, DIM).tolist(),
        "top_k": 10,
    })

    assert result["results"] == []
    assert result["count"] == 0


def test_empty_index_build_returns_zero_count(in_memory_db):
    """buildIndex with no embeddings reports zero count."""
    from backend.services.search_service import execute

    result = execute("search.buildIndex", {})
    assert result["ok"] is True
    assert result["count"] == 0


def test_empty_index_build_returns_proper_message(in_memory_db):
    """buildIndex with no embeddings returns zero count with a message."""
    from backend.services.search_service import execute

    result = execute("search.buildIndex", {})
    assert result["ok"] is True
    assert result["count"] == 0
    assert "message" in result


def test_empty_index_does_not_crash_on_repeated_search(in_memory_db):
    """Multiple searches on empty index all return empty without errors."""
    from backend.services.search_service import execute

    for _ in range(3):
        result = execute("search.searchByVector", {
            "vector": _normalized_vector(0, DIM).tolist(),
            "top_k": 10,
        })
        assert result["results"] == []
        assert result["count"] == 0


# ── 5. top_k truncation ───────────────────────────────────────────────────

def test_top_k_limits_results(in_memory_db):
    """top_k parameter correctly limits number of returned results."""
    from backend.services.search_service import execute

    # Insert 10 images with vectors
    for i in range(10):
        _insert_image_and_vector(in_memory_db, f"img-{i}", i * 50)
    in_memory_db.commit()

    execute("search.buildIndex", {})

    for k in [1, 3, 5, 10]:
        result = execute("search.searchByVector", {
            "vector": _normalized_vector(0, DIM).tolist(),
            "top_k": k,
        })
        assert result["count"] == k, f"top_k={k} but got {result['count']}"
        assert len(result["results"]) == k


def test_top_k_larger_than_index_returns_all(in_memory_db):
    """When top_k > total vectors, return all available results."""
    from backend.services.search_service import execute

    for i in range(3):
        _insert_image_and_vector(in_memory_db, f"img-{i}", i * 50)
    in_memory_db.commit()

    execute("search.buildIndex", {})

    # Request more than we have
    result = execute("search.searchByVector", {
        "vector": _normalized_vector(0, DIM).tolist(),
        "top_k": 100,
    })

    assert result["count"] == 3
    assert len(result["results"]) == 3


def test_top_k_one_returns_best_match_only(in_memory_db):
    """top_k=1 returns exactly one result (the best match)."""
    from backend.services.search_service import execute

    for i in range(5):
        _insert_image_and_vector(in_memory_db, f"img-{i}", i * 50)
    in_memory_db.commit()

    execute("search.buildIndex", {})

    result = execute("search.searchByVector", {
        "vector": _normalized_vector(100, DIM).tolist(),
        "top_k": 1,
    })

    assert result["count"] == 1
    assert len(result["results"]) == 1
    assert result["results"][0]["img_id"] == "img-2"  # seed 100 = img-2


# ── 6. Rebuild index with new data ────────────────────────────────────────

def test_rebuild_index_picks_up_new_vectors(in_memory_db):
    """After adding new vectors and rebuilding, search finds them."""
    from backend.services.search_service import execute

    # First batch
    for i in range(3):
        _insert_image_and_vector(in_memory_db, f"batch1-{i}", i * 50)
    in_memory_db.commit()

    execute("search.buildIndex", {})

    result = execute("search.searchByVector", {
        "vector": _normalized_vector(0, DIM).tolist(),
        "top_k": 10,
    })
    assert result["count"] == 3

    # Add more vectors
    for i in range(3, 6):
        _insert_image_and_vector(in_memory_db, f"batch2-{i}", i * 50)
    in_memory_db.commit()

    # Rebuild
    execute("search.rebuildIndex", {})

    result = execute("search.searchByVector", {
        "vector": _normalized_vector(0, DIM).tolist(),
        "top_k": 10,
    })
    assert result["count"] == 6


# ── 7. Vector blob round-trip ─────────────────────────────────────────────

def test_vector_blob_round_trip(in_memory_db):
    """Vectors stored as BLOB can be read back and used in search."""
    import backend.services.search_service as svc
    from backend.services.search_service import execute

    vec = _normalized_vector(42, DIM)
    blob = _vector_blob(vec)

    in_memory_db.execute(
        "INSERT INTO images (img_id, source_type, file_path, filename) VALUES (?, ?, ?, ?)",
        ("img-rt", "file_image", "/test/rt.jpg", "rt.jpg"),
    )
    in_memory_db.execute(
        "INSERT INTO vector_embeddings (img_id, vector_dim, vector_blob) VALUES (?, ?, ?)",
        ("img-rt", DIM, blob),
    )
    in_memory_db.commit()

    # Read back via _blob_to_vector
    row = in_memory_db.execute(
        "SELECT vector_blob FROM vector_embeddings WHERE img_id = 'img-rt'"
    ).fetchone()
    restored = svc._blob_to_vector(row["vector_blob"], DIM)
    assert restored.shape == (1, DIM)
    assert np.allclose(vec, restored[0], atol=1e-5)

    # Build index and search — should find it
    execute("search.buildIndex", {})
    result = execute("search.searchByVector", {
        "vector": vec.tolist(),
        "top_k": 10,
    })
    assert result["count"] == 1
    assert result["results"][0]["img_id"] == "img-rt"
    assert result["results"][0]["similarity"] > 0.99


# ── 8. Similarity score distribution ──────────────────────────────────────

def test_similarity_scores_are_between_neg1_and_1(in_memory_db):
    """FAISS Inner Product on normalized vectors yields cosine similarity [-1, 1]."""
    from backend.services.search_service import execute

    for i in range(5):
        _insert_image_and_vector(in_memory_db, f"img-{i}", i * 55)
    in_memory_db.commit()

    execute("search.buildIndex", {})

    result = execute("search.searchByVector", {
        "vector": _normalized_vector(0, DIM).tolist(),
        "top_k": 10,
    })

    for r in result["results"]:
        sim = r["similarity"]
        assert -1.0 <= sim <= 1.0, f"Similarity {sim} out of [-1, 1] range for {r['img_id']}"
