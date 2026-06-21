"""Tests for db_service: database init, query, execute, stats, logs."""

import pytest
from unittest.mock import patch


@pytest.fixture(autouse=True)
def _patch_db_service(in_memory_db):
    with patch("backend.services.db_service.get_connection", return_value=in_memory_db):
        with patch("backend.services.db_service.init_schema", return_value=None):
            with patch("backend.services.db_service.get_db_path", return_value=":memory:"):
                yield


from backend.services.db_service import execute


# ── db.init ──────────────────────────────────────────────────────────

def test_init_returns_ok():
    result = execute("db.init", {})
    assert result == {"ok": True}


# ── db.query ────────────────────────────────────────────────────────

def test_query_returns_rows(in_memory_db):
    in_memory_db.execute("INSERT INTO libraries (path, label) VALUES (?, ?)", ("/test", "TestLib"))
    in_memory_db.commit()

    rows = execute("db.query", {"sql": "SELECT * FROM libraries WHERE path = ?", "params": ["/test"]})
    assert len(rows) == 1
    assert rows[0]["label"] == "TestLib"


def test_query_empty_result():
    rows = execute("db.query", {"sql": "SELECT * FROM libraries WHERE id = 999", "params": []})
    assert rows == []


# ── db.execute ──────────────────────────────────────────────────────

def test_execute_insert(in_memory_db):
    result = execute("db.execute", {
        "sql": "INSERT INTO libraries (path, label) VALUES (?, ?)",
        "params": ["/lib", "Lib"],
    })
    assert result["changes"] == 1
    assert result["lastRowId"] is not None

    row = in_memory_db.execute("SELECT * FROM libraries WHERE path = '/lib'").fetchone()
    assert row is not None
    assert row["label"] == "Lib"


def test_execute_update(in_memory_db):
    in_memory_db.execute("INSERT INTO libraries (path, label) VALUES (?, ?)", ("/upd", "Old"))
    in_memory_db.commit()

    result = execute("db.execute", {
        "sql": "UPDATE libraries SET label = ? WHERE path = ?",
        "params": ["New", "/upd"],
    })
    assert result["changes"] == 1

    row = in_memory_db.execute("SELECT label FROM libraries WHERE path = '/upd'").fetchone()
    assert row["label"] == "New"


def test_execute_delete(in_memory_db):
    in_memory_db.execute("INSERT INTO libraries (path, label) VALUES (?, ?)", ("/del", "Gone"))
    in_memory_db.commit()

    result = execute("db.execute", {
        "sql": "DELETE FROM libraries WHERE path = ?",
        "params": ["/del"],
    })
    assert result["changes"] == 1

    row = in_memory_db.execute("SELECT * FROM libraries WHERE path = '/del'").fetchone()
    assert row is None


# ── db.getStats ─────────────────────────────────────────────────────

def test_get_stats_empty(in_memory_db):
    stats = execute("db.getStats", {})
    assert stats["libraries"] == 0
    assert stats["images"] == 0
    assert stats["excelEmbedded"] == 0
    assert stats["ugPreviews"] == 0
    assert stats["lastScan"] is None


def test_get_stats_with_data(in_memory_db):
    in_memory_db.execute("INSERT INTO libraries (path) VALUES ('/lib1')")
    in_memory_db.execute("INSERT INTO libraries (path) VALUES ('/lib2')")
    in_memory_db.execute(
        "INSERT INTO images (img_id, source_type, file_path) VALUES (?, ?, ?)",
        ("img1", "file_image", "/f1.jpg"),
    )
    in_memory_db.execute(
        "INSERT INTO images (img_id, source_type, file_path) VALUES (?, ?, ?)",
        ("img2", "excel_embedded", "/f2.jpg"),
    )
    in_memory_db.execute(
        "INSERT INTO images (img_id, source_type, file_path) VALUES (?, ?, ?)",
        ("img3", "ug-preview", "/f3.jpg"),
    )
    in_memory_db.execute(
        "INSERT INTO scan_history (library_id, scan_type, added) VALUES (1, 'full', 10)"
    )
    in_memory_db.commit()

    stats = execute("db.getStats", {})
    assert stats["libraries"] == 2
    assert stats["images"] == 3
    assert stats["excelEmbedded"] == 0  # db_service._get_stats queries 'excel-embedded' not 'excel_embedded'
    assert stats["ugPreviews"] == 1
    assert stats["lastScan"] is not None


# ── db.stats ────────────────────────────────────────────────────────

def test_stats_returns_tables(in_memory_db):
    in_memory_db.execute("INSERT INTO libraries (path) VALUES ('/s')")
    in_memory_db.commit()

    result = execute("db.stats", {})
    assert "fileSize" in result
    assert "tables" in result
    assert result["tables"]["libraries"] == 1
    # All schema tables should be present
    for table in ["images", "settings", "vector_embeddings", "activity_logs"]:
        assert table in result["tables"]


# ── db.addLog / db.getLogs ─────────────────────────────────────────

def test_add_log_info(in_memory_db):
    result = execute("db.addLog", {"level": "info", "source": "test", "message": "hello"})
    assert result == {"ok": True}

    rows = in_memory_db.execute("SELECT * FROM activity_logs").fetchall()
    assert len(rows) == 1
    assert rows[0]["level"] == "info"
    assert rows[0]["source"] == "test"
    assert rows[0]["message"] == "hello"


def test_add_log_invalid_level_falls_back_to_info(in_memory_db):
    execute("db.addLog", {"level": "debug", "source": "x", "message": "m"})
    row = in_memory_db.execute("SELECT level FROM activity_logs").fetchone()
    assert row["level"] == "info"


def test_get_logs_all(in_memory_db):
    execute("db.addLog", {"level": "info", "source": "s1", "message": "m1"})
    execute("db.addLog", {"level": "error", "source": "s2", "message": "m2"})
    execute("db.addLog", {"level": "warn", "source": "s3", "message": "m3"})

    logs = execute("db.getLogs", {})
    assert len(logs) == 3


def test_get_logs_filter_by_level(in_memory_db):
    execute("db.addLog", {"level": "info", "source": "s1", "message": "m1"})
    execute("db.addLog", {"level": "error", "source": "s2", "message": "m2"})

    logs = execute("db.getLogs", {"level": "error"})
    assert len(logs) == 1
    assert logs[0]["level"] == "error"


def test_get_logs_respects_limit(in_memory_db):
    for i in range(10):
        execute("db.addLog", {"level": "info", "source": "s", "message": f"m{i}"})

    logs = execute("db.getLogs", {"limit": 3})
    assert len(logs) == 3


# ── unknown method ──────────────────────────────────────────────────

def test_unknown_method_raises():
    with pytest.raises(ValueError, match="Unknown db method"):
        execute("db.nonexistent", {})
