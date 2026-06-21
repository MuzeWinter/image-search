"""数据库通用操作服务"""

import sqlite3
from backend.db.connection import get_connection, init_schema


def execute(method: str, params: dict):
    if method == "db.init":
        return _init()
    elif method == "db.query":
        return _query(params.get("sql", ""), params.get("params", []))
    elif method == "db.execute":
        return _execute(params.get("sql", ""), params.get("params", []))
    elif method == "db.getStats":
        return _get_stats()
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
    return {
        "libraries": lib_count,
        "images": img_count,
        "excelEmbedded": embedded_count,
        "ugPreviews": ug_count,
    }
