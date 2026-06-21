"""资料库服务: libraries 表 CRUD"""

from backend.db.connection import get_connection


def execute(method: str, params: dict):
    if method == "library.list":
        return _list()
    elif method == "library.add":
        return _add(params.get("path", ""), params.get("label"))
    elif method == "library.remove":
        return _remove(params.get("id"))
    elif method == "library.get":
        return _get(params.get("id"))
    else:
        raise ValueError(f"Unknown library method: {method}")


def _list():
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, path, label, file_count, image_count, last_scan, status, created_at "
        "FROM libraries ORDER BY created_at DESC"
    ).fetchall()
    return [dict(row) for row in rows]


def _add(path: str, label: str | None):
    if not path:
        raise ValueError("library path is required")
    conn = get_connection()
    conn.execute(
        "INSERT INTO libraries (path, label) VALUES (?, ?)",
        (path, label or path),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM libraries WHERE id = last_insert_rowid()").fetchone()
    return dict(row)


def _remove(lib_id):
    if lib_id is None:
        raise ValueError("library id is required")
    conn = get_connection()
    conn.execute("DELETE FROM libraries WHERE id = ?", (lib_id,))
    conn.commit()
    return {"ok": True}


def _get(lib_id):
    conn = get_connection()
    row = conn.execute("SELECT * FROM libraries WHERE id = ?", (lib_id,)).fetchone()
    if row is None:
        raise ValueError(f"Library {lib_id} not found")
    return dict(row)
