"""设置服务: SQLite key-value 存取 + 数据维护"""

import os
import shutil
import time
import glob
import tempfile
import sys

from backend.db.connection import get_connection, get_db_path


def _log(msg: str):
    print(f"[settings_service] {msg}", file=sys.stderr, flush=True)


def execute(method: str, params: dict):
    if method == "settings.get":
        return _get(params.get("key", ""))
    elif method == "settings.getAll":
        return _get_all()
    elif method == "settings.set":
        return _set(params.get("key", ""), params.get("value", ""))
    elif method == "settings.delete":
        return _delete(params.get("key", ""))
    elif method == "settings.backup":
        return _backup(params.get("target_path", ""))
    elif method == "settings.restore":
        return _restore(params.get("source_path", ""))
    elif method == "settings.rebuildIndex":
        return _rebuild_index()
    elif method == "settings.clearCache":
        return _clear_cache()
    else:
        raise ValueError(f"Unknown settings method: {method}")


def _get(key: str):
    conn = get_connection()
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else None


def _get_all():
    conn = get_connection()
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    result = {}
    for row in rows:
        result[row["key"]] = row["value"]
    return result


def _set(key: str, value: str):
    conn = get_connection()
    conn.execute(
        "INSERT INTO settings (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        (key, value),
    )
    conn.commit()
    return {"ok": True}


def _delete(key: str):
    conn = get_connection()
    conn.execute("DELETE FROM settings WHERE key = ?", (key,))
    conn.commit()
    return {"ok": True}


def _backup(target_path: str):
    if not target_path:
        raise ValueError("target_path is required")
    db_path = get_db_path()
    if not os.path.exists(db_path):
        raise RuntimeError(f"Database file not found: {db_path}")

    target_dir = os.path.dirname(target_path)
    if target_dir:
        os.makedirs(target_dir, exist_ok=True)

    shutil.copy2(db_path, target_path)
    _log(f"Backed up database to {target_path}")

    wal_path = db_path + "-wal"
    shm_path = db_path + "-shm"
    target_base = os.path.splitext(target_path)[0]
    if os.path.exists(wal_path):
        shutil.copy2(wal_path, target_base + ".db-wal")
    if os.path.exists(shm_path):
        shutil.copy2(shm_path, target_base + ".db-shm")

    return {"ok": True, "backup_path": target_path}


def _restore(source_path: str):
    if not source_path:
        raise ValueError("source_path is required")
    if not os.path.exists(source_path):
        raise RuntimeError(f"Source file not found: {source_path}")

    db_path = get_db_path()
    db_dir = os.path.dirname(db_path)

    timestamp = str(int(time.time()))
    backup_path = db_path + ".backup." + timestamp
    if os.path.exists(db_path):
        shutil.copy2(db_path, backup_path)
        _log(f"Current DB backed up to {backup_path}")

    shutil.copy2(source_path, db_path)

    for ext in ["-wal", "-shm"]:
        p = db_path + ext
        if os.path.exists(p):
            os.remove(p)

    _log(f"Database restored from {source_path}")
    return {"ok": True, "restored_from": source_path, "old_backup": backup_path}


def _rebuild_index():
    conn = get_connection()
    row = conn.execute("SELECT COUNT(*) as n FROM vector_embeddings").fetchone()
    count = row["n"] if row else 0
    conn.execute("DELETE FROM vector_embeddings")
    conn.commit()
    _log(f"Cleared {count} vector embeddings for index rebuild")
    return {"ok": True, "deleted_vectors": count, "message": "Index cleared"}


def _clear_cache():
    tmpdir = tempfile.gettempdir()
    cleaned = 0
    for f in glob.glob(os.path.join(tmpdir, "zoobet_*")):
        try:
            os.remove(f)
            cleaned += 1
        except OSError:
            pass
    _log(f"Cleared {cleaned} cache files from {tmpdir}")
    return {"ok": True, "cleaned_files": cleaned}
