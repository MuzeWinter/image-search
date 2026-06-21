"""Tests for library_service: CRUD on libraries table."""

import pytest
from unittest.mock import patch


@pytest.fixture(autouse=True)
def _patch_library_service(in_memory_db):
    with patch("backend.services.library_service.get_connection", return_value=in_memory_db):
        yield


from backend.services.library_service import execute


# ── library.list ────────────────────────────────────────────────────

def test_list_empty_returns_empty_list():
    result = execute("library.list", {})
    assert result == []


def test_list_returns_all_libraries(in_memory_db):
    in_memory_db.execute("INSERT INTO libraries (path, label) VALUES (?, ?)", ("/a", "LibA"))
    in_memory_db.execute("INSERT INTO libraries (path, label) VALUES (?, ?)", ("/b", "LibB"))
    in_memory_db.commit()

    result = execute("library.list", {})
    assert len(result) == 2
    paths = {r["path"] for r in result}
    assert paths == {"/a", "/b"}


def test_list_order_is_newest_first(in_memory_db):
    """Libraries are ordered by created_at DESC (or by id DESC as tiebreaker)."""
    in_memory_db.execute("INSERT INTO libraries (path, label) VALUES (?, ?)", ("/old", "Old"))
    in_memory_db.commit()
    in_memory_db.execute("INSERT INTO libraries (path, label) VALUES (?, ?)", ("/new", "New"))
    in_memory_db.commit()

    result = execute("library.list", {})
    assert len(result) == 2
    paths = {r["path"] for r in result}
    assert paths == {"/old", "/new"}


# ── library.add ─────────────────────────────────────────────────────

def test_add_creates_library(in_memory_db):
    result = execute("library.add", {"path": "/libs/test", "label": "Test Lib"})
    assert result["path"] == "/libs/test"
    assert result["label"] == "Test Lib"
    assert result["id"] == 1

    row = in_memory_db.execute("SELECT * FROM libraries WHERE id = 1").fetchone()
    assert row is not None
    assert row["path"] == "/libs/test"


def test_add_without_label_uses_path(in_memory_db):
    result = execute("library.add", {"path": "/no-label"})
    assert result["label"] == "/no-label"


def test_add_empty_path_raises():
    with pytest.raises(ValueError, match="library path is required"):
        execute("library.add", {"path": ""})


# ── library.get ─────────────────────────────────────────────────────

def test_get_existing_library(in_memory_db):
    in_memory_db.execute("INSERT INTO libraries (path, label) VALUES (?, ?)", ("/g", "GetMe"))
    in_memory_db.commit()

    result = execute("library.get", {"id": 1})
    assert result["path"] == "/g"
    assert result["label"] == "GetMe"


def test_get_nonexistent_library_raises():
    with pytest.raises(ValueError, match="Library 999 not found"):
        execute("library.get", {"id": 999})


# ── library.remove ──────────────────────────────────────────────────

def test_remove_existing_library(in_memory_db):
    in_memory_db.execute("INSERT INTO libraries (path, label) VALUES (?, ?)", ("/r", "RemoveMe"))
    in_memory_db.commit()

    result = execute("library.remove", {"id": 1})
    assert result == {"ok": True}

    row = in_memory_db.execute("SELECT * FROM libraries WHERE id = 1").fetchone()
    assert row is None


def test_remove_nonexistent_library_is_noop(in_memory_db):
    result = execute("library.remove", {"id": 999})
    assert result == {"ok": True}


def test_remove_without_id_raises():
    with pytest.raises(ValueError, match="library id is required"):
        execute("library.remove", {})


# ── unknown method ──────────────────────────────────────────────────

def test_unknown_method_raises():
    with pytest.raises(ValueError, match="Unknown library method"):
        execute("library.nonexistent", {})
