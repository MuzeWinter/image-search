"""设置服务: SQLite key-value 存取"""

from backend.db.connection import get_connection


def execute(method: str, params: dict):
    if method == "settings.get":
        return _get(params.get("key", ""))
    elif method == "settings.getAll":
        return _get_all()
    elif method == "settings.set":
        return _set(params.get("key", ""), params.get("value", ""))
    elif method == "settings.delete":
        return _delete(params.get("key", ""))
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
