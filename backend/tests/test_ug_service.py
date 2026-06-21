"""Tests for ug_service: SHA256, PRT file discovery, cache, checkpoint, metadata fallback."""

import os
import sys
import json
import tempfile
import hashlib
import pytest
from unittest.mock import patch, MagicMock


# Ensure backend package is importable
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)


@pytest.fixture(autouse=True)
def _patch_ug_connection(in_memory_db):
    with patch("backend.services.ug_service.get_connection", return_value=in_memory_db):
        yield


@pytest.fixture(autouse=True)
def _patch_nxopen():
    """Ensure NXOpen is not available during tests."""
    import backend.services.ug_service as svc

    original = svc.NXOPEN_AVAILABLE
    svc.NXOPEN_AVAILABLE = False
    yield
    svc.NXOPEN_AVAILABLE = original


from backend.services.ug_service import (
    sha256_file,
    find_prt_files,
    _lookup_cache,
    _checkpoint_path,
    _load_checkpoint,
    _save_checkpoint,
    _clear_checkpoint,
    process_directory,
    execute,
    NXOPEN_AVAILABLE,
)


# ── sha256_file ──────────────────────────────────────────────────────

def test_sha256_file_consistent():
    with tempfile.NamedTemporaryFile(delete=False, suffix=".bin") as f:
        f.write(b"hello world")
        tmp = f.name
    try:
        h1 = sha256_file(tmp)
        h2 = sha256_file(tmp)
        assert h1 == h2
        assert len(h1) == 64
    finally:
        os.unlink(tmp)


def test_sha256_file_empty():
    with tempfile.NamedTemporaryFile(delete=False, suffix=".bin") as f:
        tmp = f.name
    try:
        h = sha256_file(tmp)
        expected = hashlib.sha256(b"").hexdigest()
        assert h == expected
    finally:
        os.unlink(tmp)


def test_sha256_file_different():
    with tempfile.NamedTemporaryFile(delete=False, suffix=".bin") as f:
        f.write(b"aaa")
        tmp1 = f.name
    with tempfile.NamedTemporaryFile(delete=False, suffix=".bin") as f:
        f.write(b"bbb")
        tmp2 = f.name
    try:
        assert sha256_file(tmp1) != sha256_file(tmp2)
    finally:
        os.unlink(tmp1)
        os.unlink(tmp2)


# ── find_prt_files ───────────────────────────────────────────────────

def test_find_prt_files_empty_dir():
    with tempfile.TemporaryDirectory() as d:
        result = find_prt_files(d)
        assert result == []


def test_find_prt_files_finds_prt():
    with tempfile.TemporaryDirectory() as d:
        prt = os.path.join(d, "test.prt")
        with open(prt, "w") as f:
            f.write("dummy")
        result = find_prt_files(d)
        assert len(result) == 1
        assert result[0] == prt


def test_find_prt_files_skips_dotfiles():
    with tempfile.TemporaryDirectory() as d:
        os.makedirs(os.path.join(d, ".hidden"))
        with open(os.path.join(d, ".hidden", "a.prt"), "w") as f:
            f.write("dummy")
        result = find_prt_files(d)
        assert result == []


def test_find_prt_files_skips_tilde():
    with tempfile.TemporaryDirectory() as d:
        with open(os.path.join(d, "~temp.prt"), "w") as f:
            f.write("dummy")
        result = find_prt_files(d)
        assert result == []


def test_find_prt_files_recursive():
    with tempfile.TemporaryDirectory() as d:
        sub = os.path.join(d, "subdir")
        os.makedirs(sub)
        with open(os.path.join(d, "a.prt"), "w") as f:
            f.write("top")
        with open(os.path.join(sub, "b.prt"), "w") as f:
            f.write("nested")
        result = find_prt_files(d)
        assert len(result) == 2


def test_find_prt_files_case_insensitive():
    with tempfile.TemporaryDirectory() as d:
        with open(os.path.join(d, "A.PRT"), "w") as f:
            f.write("upper")
        with open(os.path.join(d, "B.Prt"), "w") as f:
            f.write("mixed")
        result = find_prt_files(d)
        assert len(result) == 2


# ── _lookup_cache ────────────────────────────────────────────────────

def test_lookup_cache_empty_db(in_memory_db):
    assert _lookup_cache(in_memory_db, "nonexistent_hash") is None


def test_lookup_cache_hit(in_memory_db):
    preview_path = os.path.join(tempfile.gettempdir(), "test_ug_cache_hit.png")
    with open(preview_path, "wb") as f:
        f.write(b"fake-png-data")

    try:
        in_memory_db.execute(
            """INSERT INTO images (img_id, source_type, file_path, image_path, file_hash)
               VALUES (?, 'ug-preview', ?, ?, ?)""",
            ("UG-000001", "/test.prt", preview_path, "abc123"),
        )
        in_memory_db.commit()

        result = _lookup_cache(in_memory_db, "abc123")
        assert result is not None
        assert result["img_id"] == "UG-000001"
        assert result["image_path"] == preview_path

        # Missing hash returns None
        assert _lookup_cache(in_memory_db, "xyz789") is None
    finally:
        if os.path.exists(preview_path):
            os.unlink(preview_path)


def test_lookup_cache_missing_file(in_memory_db):
    """Cache miss when DB has record but preview file is missing."""
    missing_path = os.path.join(tempfile.gettempdir(), "nonexistent_preview.png")
    in_memory_db.execute(
        """INSERT INTO images (img_id, source_type, file_path, image_path, file_hash)
           VALUES (?, 'ug-preview', ?, ?, ?)""",
        ("UG-000002", "/test2.prt", missing_path, "def456"),
    )
    in_memory_db.commit()

    assert _lookup_cache(in_memory_db, "def456") is None


def test_lookup_cache_empty_file(in_memory_db):
    """Cache miss when preview file is 0 bytes."""
    empty_path = os.path.join(tempfile.gettempdir(), "empty_preview.png")
    with open(empty_path, "wb") as f:
        pass  # 0-byte file

    try:
        in_memory_db.execute(
            """INSERT INTO images (img_id, source_type, file_path, image_path, file_hash)
               VALUES (?, 'ug-preview', ?, ?, ?)""",
            ("UG-000003", "/test3.prt", empty_path, "ghi789"),
        )
        in_memory_db.commit()

        assert _lookup_cache(in_memory_db, "ghi789") is None
    finally:
        if os.path.exists(empty_path):
            os.unlink(empty_path)


# ── Checkpoint ───────────────────────────────────────────────────────

def test_checkpoint_path_deterministic():
    p1 = _checkpoint_path("/some/path")
    p2 = _checkpoint_path("/some/path")
    assert p1 == p2


def test_checkpoint_save_load_clear():
    root = "/tmp/test_ug_checkpoint"
    _clear_checkpoint(root)  # ensure clean state
    try:
        data = {"root_path": root, "prt_count": 10, "processed_count": 5}
        _save_checkpoint(root, data)

        loaded = _load_checkpoint(root)
        assert loaded["root_path"] == root
        assert loaded["prt_count"] == 10
        assert loaded["processed_count"] == 5
        assert "updated_at" in loaded

        _clear_checkpoint(root)
        assert _load_checkpoint(root) == {}
    finally:
        _clear_checkpoint(root)


def test_load_checkpoint_nonexistent():
    result = _load_checkpoint("/nonexistent/checkpoint/path")
    assert result == {}


# ── process_directory ────────────────────────────────────────────────

def test_process_directory_nonexistent_path():
    result = process_directory("/nonexistent/path/12345")
    assert "error" in result
    assert result["prt_count"] == 0
    assert result["extracted"] == 0


def test_process_directory_not_a_directory():
    with tempfile.NamedTemporaryFile() as f:
        result = process_directory(f.name)
    assert "error" in result
    assert result["extracted"] == 0


def test_process_directory_empty_dir():
    with tempfile.TemporaryDirectory() as d:
        result = process_directory(d)
    assert result["prt_count"] == 0
    assert result["extracted"] == 0
    assert result["cached"] == 0
    assert "duration_sec" in result


def test_process_directory_no_prt_files():
    with tempfile.TemporaryDirectory() as d:
        with open(os.path.join(d, "readme.txt"), "w") as f:
            f.write("not a prt")
        result = process_directory(d)
    assert result["prt_count"] == 0
    assert result["extracted"] == 0


def test_process_directory_metadata_fallback(in_memory_db):
    """When NXOpen is not available, metadata-only records are inserted."""
    with tempfile.TemporaryDirectory() as d:
        prt_path = os.path.join(d, "model.prt")
        with open(prt_path, "w") as f:
            f.write("mock prt content for testing metadata fallback")

        result = process_directory(d)
    assert result["prt_count"] == 1
    assert result["extracted"] == 0
    assert result["metadata_only"] == 1
    assert result["nxopen_available"] is False
    assert result["skipped"] == 0

    # Verify DB record
    row = in_memory_db.execute(
        "SELECT * FROM images WHERE source_type = 'ug-preview'"
    ).fetchone()
    assert row is not None
    assert row["img_id"].startswith("UG-")
    assert row["origin_path"] == prt_path
    assert row["image_path"] is None
    assert row["ug_ref"] == "model"
    assert row["file_hash"] is not None
    assert row["status"] == "metadata-only"


def test_process_directory_with_cache(in_memory_db):
    """Second run should use cache for already-extracted files."""
    with tempfile.TemporaryDirectory() as d:
        prt_path = os.path.join(d, "cached.prt")
        with open(prt_path, "w") as f:
            f.write("test prt content")

        # First run: metadata fallback (NXOpen not available)
        result1 = process_directory(d, use_cache=True)
        assert result1["prt_count"] == 1
        assert result1["metadata_only"] == 1

        # Second run: should hit cache
        result2 = process_directory(d, use_cache=True)
        assert result2["prt_count"] == 1
        assert result2["cached"] == 1
        assert result2["metadata_only"] == 0
        assert result2["extracted"] == 0


def test_process_directory_no_cache_when_disabled(in_memory_db):
    """When use_cache=False, files are re-processed."""
    with tempfile.TemporaryDirectory() as d:
        prt_path = os.path.join(d, "nocache.prt")
        with open(prt_path, "w") as f:
            f.write("test prt content")

        result1 = process_directory(d, use_cache=True)
        assert result1["metadata_only"] == 1

        result2 = process_directory(d, use_cache=False)
        # Should process again (not hit cache)
        assert result2["cached"] == 0
        assert result2["metadata_only"] == 1


def test_process_directory_duplicate_hash_skip(in_memory_db):
    """Duplicate files (same hash) are skipped."""
    with tempfile.TemporaryDirectory() as d:
        with open(os.path.join(d, "a.prt"), "w") as f:
            f.write("same content")
        with open(os.path.join(d, "b.prt"), "w") as f:
            f.write("same content")

        result = process_directory(d)
    assert result["prt_count"] == 2
    # One extracted (metadata), one skipped as duplicate
    assert result["metadata_only"] == 1
    assert result["skipped"] == 1


def test_process_directory_progress_callback():
    """Progress callback is invoked for each file."""
    calls = []

    def cb(phase, current, total, current_file):
        calls.append((phase, current, total, current_file))

    with tempfile.TemporaryDirectory() as d:
        with open(os.path.join(d, "p1.prt"), "w") as f:
            f.write("content 1")
        with open(os.path.join(d, "p2.prt"), "w") as f:
            f.write("content 2")

        process_directory(d, progress_cb=cb)

    assert len(calls) == 2
    for phase, current, total, cf in calls:
        assert phase == "ug_preview"
        assert total == 2
        assert current in (1, 2)
        assert cf.endswith(".prt")


def test_process_directory_force_ignores_cache(in_memory_db):
    """force=True ignores cache and checkpoint."""
    with tempfile.TemporaryDirectory() as d:
        prt_path = os.path.join(d, "force.prt")
        with open(prt_path, "w") as f:
            f.write("test content")

        result1 = process_directory(d)
        assert result1["metadata_only"] == 1

        result2 = process_directory(d, force=True)
        assert result2["cached"] == 0
        assert result2["metadata_only"] >= 1


# ── execute (JSON-RPC) ─────────────────────────────────────────────

def test_execute_ug_status():
    result = execute("ug.status", {})
    assert "nxopen_available" in result
    assert result["nxopen_available"] in (True, False)


def test_execute_ug_scan():
    with tempfile.TemporaryDirectory() as d:
        with open(os.path.join(d, "test.prt"), "w") as f:
            f.write("content")
        result = execute("ug.scan", {"path": d})
    assert result["prt_count"] == 1
    assert "extracted" in result
    assert "cached" in result
    assert "metadata_only" in result


def test_execute_ug_scan_with_options():
    with tempfile.TemporaryDirectory() as d:
        with open(os.path.join(d, "test.prt"), "w") as f:
            f.write("content")
        result = execute("ug.scan", {
            "path": d,
            "use_cache": False,
            "resume": False,
            "timeout_sec": 30,
            "force": True,
        })
    assert result["prt_count"] == 1


def test_execute_ug_clear_checkpoint():
    result = execute("ug.clear_checkpoint", {"path": "/tmp/test"})
    assert result["ok"] is True


def test_execute_unknown_method():
    with pytest.raises(ValueError, match="Unknown ug method"):
        execute("ug.nonexistent", {})
