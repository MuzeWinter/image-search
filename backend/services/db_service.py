"""数据库通用操作服务"""

import os
import sqlite3
from backend.db.connection import get_connection, init_schema, get_db_path


def execute(method: str, params: dict):
    if method == "db.init":
        return _init()
    elif method == "db.query":
        return _query(params.get("sql", ""), params.get("params", []))
    elif method == "db.execute":
        return _execute(params.get("sql", ""), params.get("params", []))
    elif method == "db.getStats":
        return _get_stats()
    elif method == "db.stats":
        return _stats()
    elif method == "db.vacuum":
        return _vacuum()
    elif method == "db.optimize":
        return _optimize()
    elif method == "db.addLog":
        return _add_log(params.get("level", "info"), params.get("source", ""), params.get("message", ""))
    elif method == "db.getLogs":
        return _get_logs(params.get("level"), params.get("limit", 50))
    else:
        raise ValueError(f"Unknown db method: {method}")


def _init():
    init_schema()
    return {"ok": True}


def _query(sql: str, params: list):
    conn = get_connection()
    cur = conn.execute(sql, params)
    rows = cur.fetchall()
    return [dict(row) for row in rows]


def _execute(sql: str, params: list):
    conn = get_connection()
    cur = conn.execute(sql, params)
    conn.commit()
    return {"changes": cur.rowcount, "lastRowId": cur.lastrowid}


def _get_stats():
    conn = get_connection()
    lib_count = conn.execute("SELECT COUNT(*) as n FROM libraries").fetchone()["n"]
    img_count = conn.execute("SELECT COUNT(*) as n FROM images").fetchone()["n"]
    embedded_count = conn.execute("SELECT COUNT(*) as n FROM images WHERE source_type='excel-embedded'").fetchone()["n"]
    ug_count = conn.execute("SELECT COUNT(*) as n FROM images WHERE source_type='ug-preview'").fetchone()["n"]
    last_scan_row = conn.execute("SELECT MAX(created_at) as last_scan FROM scan_history").fetchone()
    last_scan = last_scan_row["last_scan"] if last_scan_row else None
    return {
        "libraries": lib_count,
        "images": img_count,
        "excelEmbedded": embedded_count,
        "ugPreviews": ug_count,
        "lastScan": last_scan,
    }


def _add_log(level: str, source: str, message: str):
    if level not in ("info", "warn", "error"):
        level = "info"
    conn = get_connection()
    conn.execute(
        "INSERT INTO activity_logs (level, source, message) VALUES (?, ?, ?)",
        (level, source, message),
    )
    conn.commit()
    return {"ok": True}


def _get_logs(level: str = None, limit: int = 50):
    conn = get_connection()
    if level and level in ("info", "warn", "error"):
        rows = conn.execute(
            "SELECT id, level, source, message, created_at FROM activity_logs WHERE level = ? ORDER BY id DESC LIMIT ?",
            (level, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, level, source, message, created_at FROM activity_logs WHERE level IN ('info','warn','error') ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


def _get_db_file_size():
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return 0
    return os.path.getsize(db_path)


def _stats():
    conn = get_connection()
    tables = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()
    table_counts = {}
    for t in tables:
        tname = t["name"]
        try:
            row = conn.execute(f"SELECT COUNT(*) as n FROM [{tname}]").fetchone()
            table_counts[tname] = row["n"] if row else 0
        except sqlite3.Error:
            table_counts[tname] = -1

    return {
        "fileSize": _get_db_file_size(),
        "tables": table_counts,
    }


def _vacuum():
    old_size = _get_db_file_size()
    conn = get_connection()
    conn.execute("VACUUM")
    new_size = _get_db_file_size()
    freed = old_size - new_size
    return {
        "oldSize": old_size,
        "newSize": new_size,
        "freed": max(freed, 0),
    }


def _optimize():
    old_size = _get_db_file_size()
    conn = get_connection()
    conn.execute("PRAGMA optimize")
    conn.execute("REINDEX")
    conn.execute("VACUUM")
    new_size = _get_db_file_size()
    freed = old_size - new_size
    return {
        "oldSize": old_size,
        "newSize": new_size,
        "freed": max(freed, 0),
    }
