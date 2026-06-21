"""Tests for search_service: index status, embeddings, vector search."""

import pytest
import numpy as np
from unittest.mock import patch, MagicMock


@pytest.fixture(autouse=True)
def _patch_search_service(in_memory_db):
    with patch("backend.services.search_service.get_connection", return_value=in_memory_db):
        yield


@pytest.fixture(autouse=True)
def _reset_search_globals():
    """Reset FAISS index globals before each test."""
    import backend.services.search_service as svc

    svc._index = None
    svc._index_img_ids = None
    svc._index_status = {"built": False, "count": 0, "dim": 0}
    yield
    svc._index = None
    svc._index_img_ids = None
    svc._index_status = {"built": False, "count": 0, "dim": 0}


from backend.services.search_service import execute


# ── search.getIndexStatus ───────────────────────────────────────────

def test_get_index_status_initial():
    result = execute("search.getIndexStatus", {})
    assert result["built"] is False
    assert result["count"] == 0
    assert result["dim"] == 0


# ── search.listEmbeddings ───────────────────────────────────────────

def test_list_embeddings_empty():
    result = execute("search.listEmbeddings", {})
    assert result["items"] == []
    assert result["total"] == 0


def test_list_embeddings_with_data(in_memory_db):
    in_memory_db.execute(
        "INSERT OR IGNORE INTO images (img_id, source_type, file_path, filename) VALUES (?, ?, ?, ?)",
        ("img1", "file_image", "/f1.jpg", "f1.jpg"),
    )
    in_memory_db.execute(
        "INSERT INTO vector_embeddings (img_id, vector_dim, vector_blob) VALUES (?, ?, ?)",
        ("img1", 512, b"\x00" * 2048),
    )
    in_memory_db.execute(
        "INSERT OR IGNORE INTO images (img_id, source_type, file_path) VALUES (?, ?, ?)",
        ("img2", "file_image", "/f2.jpg"),
    )
    in_memory_db.execute(
        "INSERT OR IGNORE INTO images (img_id, source_type, file_path) VALUES (?, ?, ?)",
        ("img2", "file_image", "/f2.jpg"),
    )
    in_memory_db.execute(
        "INSERT INTO vector_embeddings (img_id, vector_dim, vector_blob) VALUES (?, ?, ?)",
        ("img2", 512, b"\x00" * 2048),
    )
    in_memory_db.commit()

    result = execute("search.listEmbeddings", {"limit": 10})
    assert result["total"] == 2
    assert len(result["items"]) == 2


def test_list_embeddings_pagination(in_memory_db):
    for i in range(5):
        in_memory_db.execute(
            "INSERT OR IGNORE INTO images (img_id, source_type, file_path) VALUES (?, ?, ?)",
            (f"img{i}", "file_image", f"/f{i}.jpg"),
        )
        in_memory_db.execute(
            "INSERT INTO vector_embeddings (img_id, vector_dim, vector_blob) VALUES (?, ?, ?)",
            (f"img{i}", 512, b"\x00" * 2048),
        )
    in_memory_db.commit()

    result = execute("search.listEmbeddings", {"limit": 2, "offset": 1})
    assert result["total"] == 5
    assert len(result["items"]) == 2


# ── search.deleteEmbedding ──────────────────────────────────────────

def test_delete_embedding(in_memory_db):
    in_memory_db.execute(
        "INSERT OR IGNORE INTO images (img_id, source_type, file_path) VALUES (?, ?, ?)",
        ("img-del", "file_image", "/del.jpg"),
    )
    in_memory_db.execute(
        "INSERT INTO vector_embeddings (img_id, vector_dim, vector_blob) VALUES (?, ?, ?)",
        ("img-del", 512, b"\x00" * 2048),
    )
    in_memory_db.commit()

    result = execute("search.deleteEmbedding", {"img_id": "img-del"})
    assert result["ok"] is True
    assert result["deleted"] == "img-del"

    row = in_memory_db.execute(
        "SELECT * FROM vector_embeddings WHERE img_id = 'img-del'"
    ).fetchone()
    assert row is None


def test_delete_embedding_resets_index(in_memory_db):
    import backend.services.search_service as svc

    # Simulate a built index
    svc._index = MagicMock()
    svc._index_img_ids = ["x"]
    svc._index_status = {"built": True, "count": 1, "dim": 512}

    in_memory_db.execute(
        "INSERT OR IGNORE INTO images (img_id, source_type, file_path) VALUES (?, ?, ?)",
        ("img-x", "file_image", "/x.jpg"),
    )
    in_memory_db.execute(
        "INSERT INTO vector_embeddings (img_id, vector_dim, vector_blob) VALUES (?, ?, ?)",
        ("img-x", 512, b"\x00" * 2048),
    )
    in_memory_db.commit()

    execute("search.deleteEmbedding", {"img_id": "img-x"})

    assert svc._index is None
    assert svc._index_img_ids is None
    assert svc._index_status["built"] is False


def test_delete_embedding_empty_id_raises():
    with pytest.raises(ValueError, match="img_id is required"):
        execute("search.deleteEmbedding", {"img_id": ""})


# ── search.searchByVector ───────────────────────────────────────────

def test_search_by_vector_empty_vector_raises():
    with pytest.raises(ValueError, match="vector is required"):
        execute("search.searchByVector", {"vector": []})


def test_search_by_vector_empty_index(in_memory_db):
    """Search with empty FAISS index returns no results."""
    import backend.services.search_service as svc

    # Set globals to simulate empty built index
    svc._index_status = {"built": True, "count": 0, "dim": 512}

    result = execute("search.searchByVector", {"vector": [0.1] * 512, "top_k": 10})
    assert result["results"] == []
    assert result["count"] == 0


def test_search_by_vector_with_results(in_memory_db):
    """Full vector search flow with mocked FAISS index."""
    import backend.services.search_service as svc

    # Insert images so metadata lookup works
    in_memory_db.execute(
        "INSERT INTO images (img_id, source_type, file_path, filename, folder) VALUES (?, ?, ?, ?, ?)",
        ("img-a", "file_image", "/test/a.jpg", "a.jpg", "/test"),
    )
    in_memory_db.execute(
        "INSERT INTO images (img_id, source_type, file_path, filename, folder) VALUES (?, ?, ?, ?, ?)",
        ("img-b", "file_image", "/test/b.jpg", "b.jpg", "/test"),
    )
    in_memory_db.commit()

    # Create mock FAISS index
    class MockIndex:
        def search(self, vec, k):
            return np.array([[0.95, 0.80]]), np.array([[0, 1]])

    svc._index = MockIndex()
    svc._index_img_ids = ["img-a", "img-b"]
    svc._index_status = {"built": True, "count": 2, "dim": 512}

    result = execute("search.searchByVector", {"vector": [0.1] * 512, "top_k": 10})

    assert result["count"] == 2
    assert len(result["results"]) == 2
    assert result["results"][0]["img_id"] == "img-a"
    assert result["results"][0]["similarity"] == 0.95
    assert result["results"][1]["img_id"] == "img-b"
    assert result["results"][1]["similarity"] == 0.80
    assert "duration_ms" in result


def test_search_by_vector_scope_filter(in_memory_db):
    """Scope filter excludes non-matching images."""
    import backend.services.search_service as svc

    in_memory_db.execute(
        "INSERT INTO images (img_id, source_type, file_path, filename, folder) VALUES (?, ?, ?, ?, ?)",
        ("img-file", "file_image", "/t/f.jpg", "f.jpg", "/t"),
    )
    in_memory_db.execute(
        "INSERT INTO images (img_id, source_type, file_path, filename, folder) VALUES (?, ?, ?, ?, ?)",
        ("img-excel", "excel_embedded", "/t/e.jpg", "e.jpg", "/t"),
    )
    in_memory_db.commit()

    class MockIndex:
        def search(self, vec, k):
            return np.array([[0.9, 0.7]]), np.array([[0, 1]])

    svc._index = MockIndex()
    svc._index_img_ids = ["img-file", "img-excel"]
    svc._index_status = {"built": True, "count": 2, "dim": 512}

    result = execute("search.searchByVector", {
        "vector": [0.1] * 512,
        "top_k": 10,
        "scope": "images_only",
    })

    # Only file_image should pass
    assert result["count"] == 1
    assert result["results"][0]["img_id"] == "img-file"


def test_search_by_vector_with_excel_info(in_memory_db):
    """Results include associated Excel record info."""
    import backend.services.search_service as svc

    in_memory_db.execute(
        "INSERT INTO excel_records (ex_id, file_path, filename, sheet_name, row_number, column_name, cell_value) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        ("ex1", "/x.xlsx", "x.xlsx", "Sheet1", 5, "B", "widget"),
    )
    in_memory_db.execute(
        "INSERT INTO images (img_id, source_type, file_path, filename, folder, ex_ref) VALUES (?, ?, ?, ?, ?, ?)",
        ("img-ref", "excel_embedded", "/t/r.jpg", "r.jpg", "/t", "ex1"),
    )
    in_memory_db.commit()

    class MockIndex:
        def search(self, vec, k):
            return np.array([[0.99]]), np.array([[0]])

    svc._index = MockIndex()
    svc._index_img_ids = ["img-ref"]
    svc._index_status = {"built": True, "count": 1, "dim": 512}

    result = execute("search.searchByVector", {"vector": [0.1] * 512, "top_k": 10})

    assert result["count"] == 1
    r = result["results"][0]
    assert r["ex_ref"] == "ex1"
    assert r["excel_info"] is not None
    assert r["excel_info"]["cell_value"] == "widget"


def test_search_by_vector_with_cad_info(in_memory_db):
    """Results include associated CAD file info."""
    import backend.services.search_service as svc

    in_memory_db.execute(
        "INSERT INTO cad_files (cad_id, file_path, filename, extension) VALUES (?, ?, ?, ?)",
        ("cad1", "/c.dwg", "c.dwg", "dwg"),
    )
    in_memory_db.execute(
        "INSERT INTO images (img_id, source_type, file_path, filename, folder, cad_ref) VALUES (?, ?, ?, ?, ?, ?)",
        ("img-cad", "file_image", "/t/c.jpg", "c.jpg", "/t", "cad1"),
    )
    in_memory_db.commit()

    class MockIndex:
        def search(self, vec, k):
            return np.array([[0.99]]), np.array([[0]])

    svc._index = MockIndex()
    svc._index_img_ids = ["img-cad"]
    svc._index_status = {"built": True, "count": 1, "dim": 512}

    result = execute("search.searchByVector", {"vector": [0.1] * 512, "top_k": 10})

    r = result["results"][0]
    assert r["cad_ref"] == "cad1"
    assert r["cad_info"] is not None
    assert r["cad_info"]["extension"] == "dwg"


# ── search.modelStatus ──────────────────────────────────────────────

def test_model_status_returns_keys():
    result = execute("search.modelStatus", {})
    assert "status" in result
    assert "device" in result
    assert "percent" in result
    assert "message" in result


# ── unknown method ──────────────────────────────────────────────────

def test_unknown_method_raises():
    with pytest.raises(ValueError, match="Unknown search method"):
        execute("search.nonexistent", {})
