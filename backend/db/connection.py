"""SQLite 连接管理 (WAL 模式)"""

import sqlite3
import os
import threading

_DB_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
_DB_PATH = os.path.join(_DB_DIR, "zoobet.db")
_local = threading.local()


def _ensure_dir():
    os.makedirs(_DB_DIR, exist_ok=True)


def get_db_path():
    return _DB_PATH


def get_connection() -> sqlite3.Connection:
    conn = getattr(_local, "connection", None)
    if conn is None:
        _ensure_dir()
        conn = sqlite3.connect(_DB_PATH)
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        conn.row_factory = sqlite3.Row
        _local.connection = conn
    return conn


def init_schema():
    conn = get_connection()
    schema_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")
    with open(schema_path, "r", encoding="utf-8") as f:
        conn.executescript(f.read())
    # v2-49: add ocr_text column if upgrading from older schema
    _migrate_add_column(conn, "images", "ocr_text", "TEXT DEFAULT ''")
    conn.commit()


def _migrate_add_column(conn, table: str, column: str, col_def: str):
    """Add a column if it doesn't already exist (safe for repeated runs)."""
    try:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_def}")
    except Exception:
        pass  # column already exists


def close_connection():
    conn = getattr(_local, "connection", None)
    if conn is not None:
        conn.close()
        _local.connection = None
