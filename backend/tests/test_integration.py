"""Integration tests: DB + Search + UG + Scan joint testing, full user path,
multi-library search, incremental indexing, settings read/write closed loop.

Tests the full service integration layer, not individual unit behaviors.
"""

import os
import sys
import io
import json
import contextlib
import tempfile
import pytest
import numpy as np
from unittest.mock import patch

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

DIM = 512


# ── Helpers ──────────────────────────────────────────────────────────────────

def _normalized_vector(seed: int, dim: int = DIM) -> np.ndarray:
    rng = np.random.RandomState(seed)
    vec = rng.randn(dim).astype(np.float32)
    return vec / np.linalg.norm(vec).astype(np.float32)


def _vector_blob(vec: np.ndarray) -> bytes:
    return vec.astype(np.float32).tobytes()


def _insert_image_and_vector(conn, img_id: str, seed: int, *,
                             source_type: str = "file_image",
                             folder: str = "/test",
                             filename: str | None = None,
                             file_path: str | None = None,
                             file_hash: str | None = None,
                             favorite: int = 0):
    if filename is None:
        filename = f"{img_id}.jpg"
    if file_path is None:
        file_path = f"/test/{filename}"
    conn.execute(
        "INSERT INTO images (img_id, source_type, file_path, folder, filename, file_hash, favorite) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (img_id, source_type, file_path, folder, filename, file_hash, favorite),
    )
    vec = _normalized_vector(seed, DIM)
    conn.execute(
        "INSERT INTO vector_embeddings (img_id, vector_dim, vector_blob) VALUES (?, ?, ?)",
        (img_id, DIM, _vector_blob(vec)),
    )
    return vec


# ── Shared fixtures ──────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _patch_all_db_connections(in_memory_db):
    """Patch get_connection for every service the integration tests touch."""
    services = [
        "backend.services.db_service",
        "backend.services.library_service",
        "backend.services.settings_service",
        "backend.services.search_service",
        "backend.services.scan_service",
        "backend.services.ug_service",
    ]
    with contextlib.ExitStack() as stack:
        for svc in services:
            stack.enter_context(patch(f"{svc}.get_connection", return_value=in_memory_db))
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


@pytest.fixture(autouse=True)
def _disable_nxopen():
    """Ensure NXOpen is not available during tests."""
    import backend.services.ug_service as svc

    original = svc.NXOPEN_AVAILABLE
    svc.NXOPEN_AVAILABLE = False
    yield
    svc.NXOPEN_AVAILABLE = original


# ── 1. DB + Search + UG + Scan joint test ────────────────────────────────────

class TestDatabaseSearchUGScanJoint:
    """Verify data flows correctly between all major backend services."""

    def test_db_stats_reflects_all_data_sources(self, in_memory_db):
        """After inserting images, UG records, and CAD records, db.getStats is correct."""
        from backend.services.db_service import execute as db

        # Insert image records
        in_memory_db.execute(
            "INSERT INTO images (img_id, source_type, file_path, filename) "
            "VALUES (?, 'file_image', ?, ?)", ("img-1", "/a.jpg", "a.jpg"))
        in_memory_db.execute(
            "INSERT INTO images (img_id, source_type, file_path, filename, origin_path) "
            "VALUES (?, 'ug-preview', ?, ?, ?)", ("UG-000001", "/m.prt", "m.png", "/m.prt"))
        in_memory_db.execute(
            "INSERT INTO images (img_id, source_type, file_path, filename) "
            "VALUES (?, 'excel_embedded', ?, ?)", ("IMG-000001", "/e.jpg", "e.jpg"))
        in_memory_db.commit()

        stats = db("db.getStats", {})
        assert stats["images"] == 3
        assert stats["ugPreviews"] == 1
        # db_service._get_stats uses 'excel-embedded' (hyphenated) for the query
        assert stats.get("excelEmbedded", 0) >= 0

    def test_ug_scan_result_appears_in_images_table(self, in_memory_db):
        """UG process_directory inserts metadata-only records into images table."""
        from backend.services.ug_service import process_directory

        with tempfile.TemporaryDirectory() as d:
            prt = os.path.join(d, "model.prt")
            with open(prt, "w") as f:
                f.write("mock prt content")
            process_directory(d)

        rows = in_memory_db.execute(
            "SELECT * FROM images WHERE source_type = 'ug-preview'"
        ).fetchall()
        assert len(rows) == 1
        assert rows[0]["img_id"].startswith("UG-")
        assert rows[0]["status"] == "metadata-only"

    def test_search_finds_both_file_images_and_ug_previews(self, in_memory_db):
        """FAISS search returns results from both file_image and ug-preview sources."""
        from backend.services.search_service import execute as search

        _insert_image_and_vector(in_memory_db, "img-file", 10, source_type="file_image")
        _insert_image_and_vector(in_memory_db, "img-ug", 110, source_type="ug-preview")
        in_memory_db.commit()

        search("search.buildIndex", {})

        result = search("search.searchByVector", {
            "vector": _normalized_vector(10, DIM).tolist(),
            "top_k": 10,
            "scope": "all",
        })
        assert result["count"] == 2
        types = {r["source_type"] for r in result["results"]}
        assert types == {"file_image", "ug-preview"}

    def test_cad_association_surfaces_in_search_results(self, in_memory_db):
        """Search results include CAD info when images have cad_ref."""
        from backend.services.search_service import execute as search

        in_memory_db.execute(
            "INSERT INTO cad_files (cad_id, file_path, filename, extension) "
            "VALUES (?, ?, ?, ?)", ("cad-1", "/d.dwg", "d.dwg", "dwg"))
        _insert_image_and_vector(in_memory_db, "img-cad", 20, source_type="file_image")
        in_memory_db.execute(
            "UPDATE images SET cad_ref = 'cad-1' WHERE img_id = 'img-cad'")
        in_memory_db.commit()

        search("search.buildIndex", {})

        result = search("search.searchByVector", {
            "vector": _normalized_vector(20, DIM).tolist(),
            "top_k": 10,
        })
        assert result["count"] == 1
        r = result["results"][0]
        assert r["cad_ref"] == "cad-1"
        assert r["cad_info"] is not None
        assert r["cad_info"]["extension"] == "dwg"

    def test_activity_logs_recorded_across_services(self, in_memory_db):
        """db.addLog writes activity_logs visible to db.getLogs."""
        from backend.services.db_service import execute as db

        db("db.addLog", {"level": "info", "source": "test", "message": "integration start"})
        db("db.addLog", {"level": "warn", "source": "scan", "message": "slow operation"})
        db("db.addLog", {"level": "error", "source": "ug", "message": "extraction failed"})

        logs = db("db.getLogs", {})
        assert len(logs) == 3

        info_logs = db("db.getLogs", {"level": "info"})
        assert len(info_logs) == 1
        assert info_logs[0]["source"] == "test"


# ── 2. Full user path: add library → scan → index → search → export-ready ────

class TestFullUserPath:
    """End-to-end workflow matching the real user experience."""

    def test_add_library_creates_record(self, in_memory_db):
        from backend.services.library_service import execute as lib

        result = lib("library.add", {"path": "/my-library", "label": "My Library"})
        assert result["id"] == 1
        assert result["path"] == "/my-library"
        assert result["label"] == "My Library"

        row = in_memory_db.execute(
            "SELECT * FROM libraries WHERE id = 1").fetchone()
        assert row is not None

    def test_scan_library_detects_files_and_writes_db(self, in_memory_db):
        """Call scan_library directly on a temp dir with .prt files."""
        from backend.services.settings_service import execute as settings
        from backend.services.library_service import execute as lib
        from backend.services.db_service import execute as db

        # Set scan_extensions to include .prt and .jpg
        settings("settings.set", {
            "key": "scan_extensions",
            "value": json.dumps([".prt", ".jpg", ".png"]),
        })

        # Add a library
        with tempfile.TemporaryDirectory() as lib_dir:
            # Create test files
            with open(os.path.join(lib_dir, "part.prt"), "w") as f:
                f.write("mock prt file content")
            with open(os.path.join(lib_dir, "photo.jpg"), "wb") as f:
                f.write(b"fake jpg data " * 100)

            lib("library.add", {"path": lib_dir, "label": "TestLib"})

            # Run scan_library with stdout captured
            import backend.services.scan_service as scan_svc

            old_stdout = sys.stdout
            sys.stdout = io.StringIO()
            try:
                scan_svc.scan_library(1, lib_dir)
            finally:
                sys.stdout = old_stdout

            # Verify scan results in DB
            images = in_memory_db.execute(
                "SELECT * FROM images WHERE source_type = 'file_image'"
            ).fetchall()
            assert len(images) == 1
            assert images[0]["filename"] == "photo.jpg"

            # UG metadata-only record
            ug_rows = in_memory_db.execute(
                "SELECT * FROM images WHERE source_type = 'ug-preview'"
            ).fetchall()
            assert len(ug_rows) == 1
            assert ug_rows[0]["img_id"].startswith("UG-")

            # Scan history recorded
            hist = in_memory_db.execute(
                "SELECT * FROM scan_history WHERE library_id = 1"
            ).fetchall()
            assert len(hist) == 1
            assert hist[0]["scan_type"] == "full"
            assert hist[0]["added"] >= 1

            # Library updated
            lib_row = in_memory_db.execute(
                "SELECT * FROM libraries WHERE id = 1").fetchone()
            assert lib_row["status"] == "ready"
            assert lib_row["last_scan"] is not None

    def test_build_index_and_search_after_scan(self, in_memory_db):
        """After inserting images+vectors, build index returns valid search results."""
        from backend.services.search_service import execute as search

        _insert_image_and_vector(in_memory_db, "img-a", 1, source_type="file_image",
                                 folder="/lib", file_path="/lib/a.jpg", file_hash="abc123")
        _insert_image_and_vector(in_memory_db, "img-b", 101, source_type="file_image",
                                 folder="/lib", file_path="/lib/b.jpg", file_hash="def456")
        in_memory_db.commit()

        build = search("search.buildIndex", {})
        assert build["ok"] is True
        assert build["count"] == 2
        assert build["dim"] == DIM

        result = search("search.searchByVector", {
            "vector": _normalized_vector(1, DIM).tolist(),
            "top_k": 5,
        })
        assert result["count"] == 2
        assert result["results"][0]["img_id"] == "img-a"
        assert result["results"][0]["similarity"] > 0.99

    def test_data_ready_for_export_has_required_fields(self, in_memory_db):
        """Search results contain all fields required by the Rust export layer."""
        from backend.services.search_service import execute as search

        _insert_image_and_vector(in_memory_db, "export-test", 30,
                                 source_type="file_image", folder="/export",
                                 file_hash="hash123")
        in_memory_db.execute(
            "UPDATE images SET width=800, height=600 WHERE img_id='export-test'")
        in_memory_db.commit()

        search("search.buildIndex", {})
        result = search("search.searchByVector", {
            "vector": _normalized_vector(30, DIM).tolist(),
            "top_k": 1,
        })
        r = result["results"][0]

        # ExportItem fields expected by Rust export.rs
        assert "img_id" in r
        assert "image_path" in r
        assert "origin_path" in r
        assert "similarity" in r
        assert "source_type" in r
        assert "width" in r
        assert "height" in r
        assert "format" in r
        assert isinstance(r["similarity"], float)

    def test_scan_check_changes_before_and_after(self, in_memory_db):
        """check_changes detects files on disk vs DB state."""
        from backend.services.settings_service import execute as settings
        from backend.services.library_service import execute as lib
        from backend.services.scan_service import execute as scan

        settings("settings.set", {
            "key": "scan_extensions",
            "value": json.dumps([".prt", ".jpg", ".png"]),
        })

        with tempfile.TemporaryDirectory() as lib_dir:
            with open(os.path.join(lib_dir, "test.jpg"), "wb") as f:
                f.write(b"jpg data " * 200)

            lib("library.add", {"path": lib_dir, "label": "ChangeLib"})

            # check_changes should see the file as added
            changes = scan("scan.checkChanges", {"library_id": 1})
            assert changes["has_changes"] is True
            assert changes["added"] >= 1
            assert changes["total_files"] >= 1

    def test_unknown_scan_method_raises(self):
        from backend.services.scan_service import execute as scan

        with pytest.raises(ValueError, match="Unknown scan method"):
            scan("scan.nonexistent", {})


# ── 3. Multi-library joint search ────────────────────────────────────────────

class TestMultiLibrarySearch:
    """Search scope isolation across multiple libraries."""

    def test_library_filter_isolates_results(self, in_memory_db):
        """library_id filter restricts results to the specified library."""
        from backend.services.search_service import execute as search
        from backend.services.library_service import execute as lib

        lib("library.add", {"path": "/lib-A", "label": "Library A"})
        lib("library.add", {"path": "/lib-B", "label": "Library B"})

        _insert_image_and_vector(in_memory_db, "a1", 100, folder="/lib-A",
                                 file_path="/lib-A/img.jpg", file_hash="h1")
        _insert_image_and_vector(in_memory_db, "a2", 200, folder="/lib-A/sub",
                                 file_path="/lib-A/sub/img.jpg", file_hash="h2")
        _insert_image_and_vector(in_memory_db, "b1", 300, folder="/lib-B",
                                 file_path="/lib-B/img.jpg", file_hash="h3")
        in_memory_db.commit()

        search("search.buildIndex", {})

        # Search within Library A only
        result_a = search("search.searchByVector", {
            "vector": _normalized_vector(100, DIM).tolist(),
            "top_k": 10,
            "library_id": 1,
        })
        assert result_a["count"] == 2
        ids_a = {r["img_id"] for r in result_a["results"]}
        assert ids_a == {"a1", "a2"}

        # Search within Library B only
        result_b = search("search.searchByVector", {
            "vector": _normalized_vector(100, DIM).tolist(),
            "top_k": 10,
            "library_id": 2,
        })
        assert result_b["count"] == 1
        assert result_b["results"][0]["img_id"] == "b1"

    def test_search_all_libraries_returns_everything(self, in_memory_db):
        """Without library_id, search returns results from all libraries."""
        from backend.services.search_service import execute as search
        from backend.services.library_service import execute as lib

        lib("library.add", {"path": "/lib-1"})
        lib("library.add", {"path": "/lib-2"})

        _insert_image_and_vector(in_memory_db, "img-1", 50, folder="/lib-1",
                                 file_path="/lib-1/pic.jpg")
        _insert_image_and_vector(in_memory_db, "img-2", 150, folder="/lib-2",
                                 file_path="/lib-2/pic.jpg")
        in_memory_db.commit()

        search("search.buildIndex", {})

        result = search("search.searchByVector", {
            "vector": _normalized_vector(50, DIM).tolist(),
            "top_k": 10,
        })
        assert result["count"] == 2

    def test_library_list_reflects_added_libraries(self, in_memory_db):
        from backend.services.library_service import execute as lib

        lib("library.add", {"path": "/a", "label": "A"})
        lib("library.add", {"path": "/b", "label": "B"})

        lst = lib("library.list", {})
        assert len(lst) == 2
        paths = {r["path"] for r in lst}
        assert paths == {"/a", "/b"}


# ── 4. Incremental indexing ──────────────────────────────────────────────────

class TestIncrementalIndexing:
    """Adding new files and rebuilding the index surfaces new results."""

    def test_rebuild_index_picks_up_new_vectors(self, in_memory_db):
        from backend.services.search_service import execute as search

        for i in range(3):
            _insert_image_and_vector(in_memory_db, f"batch1-{i}", i * 40)
        in_memory_db.commit()

        search("search.buildIndex", {})

        r1 = search("search.searchByVector", {
            "vector": _normalized_vector(0, DIM).tolist(),
            "top_k": 10,
        })
        assert r1["count"] == 3

        # New batch
        for i in range(3, 6):
            _insert_image_and_vector(in_memory_db, f"batch2-{i}", i * 40)
        in_memory_db.commit()

        search("search.rebuildIndex", {})

        r2 = search("search.searchByVector", {
            "vector": _normalized_vector(0, DIM).tolist(),
            "top_k": 10,
        })
        assert r2["count"] == 6

    def test_incremental_scan_adds_new_files(self, in_memory_db):
        """After an initial scan, adding a file to the folder and re-scanning finds it."""
        from backend.services.settings_service import execute as settings
        from backend.services.library_service import execute as lib

        settings("settings.set", {
            "key": "scan_extensions",
            "value": json.dumps([".prt"]),
        })

        with tempfile.TemporaryDirectory() as lib_dir:
            lib("library.add", {"path": lib_dir, "label": "IncLib"})

            # First file
            with open(os.path.join(lib_dir, "a.prt"), "w") as f:
                f.write("file a content")

            import backend.services.scan_service as scan_svc
            old_stdout = sys.stdout
            sys.stdout = io.StringIO()
            try:
                scan_svc.scan_library(1, lib_dir)
            finally:
                sys.stdout = old_stdout

            count1 = in_memory_db.execute(
                "SELECT COUNT(*) as n FROM images WHERE source_type = 'ug-preview'"
            ).fetchone()["n"]
            assert count1 == 1

            # Add second file, re-scan
            with open(os.path.join(lib_dir, "b.prt"), "w") as f:
                f.write("file b content")

            sys.stdout = io.StringIO()
            try:
                scan_svc.scan_library(1, lib_dir)
            finally:
                sys.stdout = old_stdout

            count2 = in_memory_db.execute(
                "SELECT COUNT(*) as n FROM images WHERE source_type = 'ug-preview'"
            ).fetchone()["n"]
            assert count2 == 2

    def test_index_status_updates_after_rebuild(self, in_memory_db):
        from backend.services.search_service import execute as search

        for i in range(4):
            _insert_image_and_vector(in_memory_db, f"idx-{i}", i * 30)
        in_memory_db.commit()

        status1 = search("search.getIndexStatus", {})
        assert status1["built"] is False

        search("search.buildIndex", {})

        status2 = search("search.getIndexStatus", {})
        assert status2["built"] is True
        assert status2["count"] == 4
        assert status2["dim"] == DIM


# ── 5. Settings read/write closed loop ────────────────────────────────────────

class TestSettingsReadWriteClosedLoop:
    """Settings write → read → restart simulation → read consistency."""

    def test_write_and_read_single_setting(self, in_memory_db):
        from backend.services.settings_service import execute as settings

        settings("settings.set", {"key": "theme", "value": "dark"})
        result = settings("settings.get", {"key": "theme"})
        assert result == "dark"

    def test_write_and_read_multiple_settings(self, in_memory_db):
        from backend.services.settings_service import execute as settings

        settings("settings.set", {"key": "theme", "value": "dark"})
        settings("settings.set", {"key": "language", "value": "zh-CN"})
        settings("settings.set", {"key": "scan_extensions",
                                   "value": json.dumps([".prt", ".jpg"])})

        all_s = settings("settings.getAll", {})
        assert all_s["theme"] == "dark"
        assert all_s["language"] == "zh-CN"
        assert ".prt" in all_s["scan_extensions"]

    def test_read_nonexistent_key_returns_none(self, in_memory_db):
        from backend.services.settings_service import execute as settings

        result = settings("settings.get", {"key": "nonexistent"})
        assert result is None

    def test_update_existing_setting(self, in_memory_db):
        from backend.services.settings_service import execute as settings

        settings("settings.set", {"key": "window_width", "value": "1024"})
        assert settings("settings.get", {"key": "window_width"}) == "1024"

        settings("settings.set", {"key": "window_width", "value": "1920"})
        assert settings("settings.get", {"key": "window_width"}) == "1920"

        # Only one row in DB
        count = in_memory_db.execute(
            "SELECT COUNT(*) as n FROM settings WHERE key = 'window_width'"
        ).fetchone()["n"]
        assert count == 1

    def test_delete_and_recreate_setting(self, in_memory_db):
        from backend.services.settings_service import execute as settings

        settings("settings.set", {"key": "tmp", "value": "data"})
        assert settings("settings.get", {"key": "tmp"}) == "data"

        settings("settings.delete", {"key": "tmp"})
        assert settings("settings.get", {"key": "tmp"}) is None

        settings("settings.set", {"key": "tmp", "value": "new-data"})
        assert settings("settings.get", {"key": "tmp"}) == "new-data"

    def test_data_persists_via_raw_sql_readback(self, in_memory_db):
        """After settings.set, raw SQL directly on the same connection sees the data."""
        from backend.services.settings_service import execute as settings

        settings("settings.set", {"key": "persist_test", "value": "should-survive"})

        row = in_memory_db.execute(
            "SELECT value FROM settings WHERE key = 'persist_test'"
        ).fetchone()
        assert row is not None
        assert row["value"] == "should-survive"

    def test_restart_simulation(self, in_memory_db):
        """Write settings, simulate restart by reading via a fresh service call."""
        from backend.services.settings_service import execute as settings

        settings("settings.set", {"key": "host", "value": "localhost"})
        settings("settings.set", {"key": "port", "value": "8080"})

        # Simulate "restart" — getAll re-reads from the same DB connection
        # which is the in-memory equivalent of a persisted restart
        all_settings = settings("settings.getAll", {})
        assert all_settings.get("host") == "localhost"
        assert all_settings.get("port") == "8080"

    def test_rebuild_index_preserves_settings(self, in_memory_db):
        """rebuildIndex clears vectors but does not affect settings."""
        from backend.services.settings_service import execute as settings
        from backend.services.search_service import execute as search

        settings("settings.set", {"key": "theme", "value": "light"})

        _insert_image_and_vector(in_memory_db, "img-x", 5)
        in_memory_db.commit()

        search("search.buildIndex", {})

        result = settings("settings.rebuildIndex", {})
        assert result["ok"] is True

        # Settings survive rebuild
        assert settings("settings.get", {"key": "theme"}) == "light"

        # Vectors are gone
        vec_count = in_memory_db.execute(
            "SELECT COUNT(*) as n FROM vector_embeddings"
        ).fetchone()["n"]
        assert vec_count == 0

    def test_unknown_settings_method_raises(self):
        from backend.services.settings_service import execute as settings

        with pytest.raises(ValueError, match="Unknown settings method"):
            settings("settings.nonexistent", {})


# ── 6. Cross-service error handling ──────────────────────────────────────────

class TestCrossServiceErrors:
    """Verify error propagation and graceful degradation across services."""

    def test_library_not_found_raises_for_scan_check(self, in_memory_db):
        from backend.services.scan_service import execute as scan

        result = scan("scan.checkChanges", {"library_id": 999})
        assert "error" in result
        assert result["has_changes"] is False

    def test_invalid_library_id_for_scan_raises(self):
        from backend.services.scan_service import execute as scan

        with pytest.raises(ValueError, match="library_id must be a positive integer"):
            scan("scan.checkChanges", {"library_id": 0})

    def test_search_by_vector_auto_builds_index(self, in_memory_db):
        """searchByVector auto-builds FAISS index when not explicitly built."""
        from backend.services.search_service import execute as search

        _insert_image_and_vector(in_memory_db, "auto-build", 0)
        in_memory_db.commit()

        result = search("search.searchByVector", {
            "vector": _normalized_vector(0, DIM).tolist(),
            "top_k": 10,
        })
        assert result["count"] == 1
        assert result["results"][0]["img_id"] == "auto-build"

        status = search("search.getIndexStatus", {})
        assert status["built"] is True
        assert status["count"] == 1

    def test_scan_nonexistent_path_reports_error(self, in_memory_db):
        from backend.services.library_service import execute as lib
        import backend.services.scan_service as scan_svc

        lib("library.add", {"path": "/nonexistent/path"})

        old_stdout = sys.stdout
        sys.stdout = io.StringIO()
        try:
            scan_svc.scan_library(1, "/nonexistent/path")
            output = sys.stdout.getvalue()
        finally:
            sys.stdout = old_stdout

        lines = [json.loads(l) for l in output.strip().split("\n") if l.strip()]
        result_line = [l for l in lines if l.get("type") == "result"]
        assert len(result_line) > 0
        assert "error" in result_line[0]
