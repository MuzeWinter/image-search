"""Match management service - link images to Excel/CAD/PDF records.

Provides match listing, confirm, reject, and manual bind operations.
Human-confirmed matches are protected from automatic overwrite.
"""

import sys
import os

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from backend.db.connection import get_connection


def execute(method: str, params: dict):
    if method == "match.listByStatus":
        return _list_by_status(params.get("status", "auto"), params.get("limit", 100), params.get("offset", 0))
    elif method == "match.getStats":
        return _get_stats()
    elif method == "match.confirm":
        return _confirm(params.get("id"))
    elif method == "match.reject":
        return _reject(params.get("id"))
    elif method == "match.bind":
        return _bind(params)
    elif method == "match.listUnmatched":
        return _list_unmatched(params.get("limit", 100), params.get("offset", 0))
    else:
        raise ValueError(f"Unknown match method: {method}")


def _list_by_status(status: str, limit: int, offset: int):
    conn = get_connection()

    if status == "all":
        rows = conn.execute(
            """SELECT m.*,
                    i.filename as img_filename, i.file_path as img_path,
                    e.filename as excel_filename, e.file_path as excel_path, e.sheet_name,
                    c.filename as cad_filename, c.file_path as cad_path, c.extension as cad_ext,
                    p.filename as pdf_filename, p.file_path as pdf_path, p.page_count
             FROM matches m
             LEFT JOIN images i ON m.img_id = i.img_id
             LEFT JOIN excel_records e ON m.ex_id = e.ex_id
             LEFT JOIN cad_files c ON m.cad_id = c.cad_id
             LEFT JOIN pdf_files p ON m.pdf_id = p.doc_id
             ORDER BY m.updated_at DESC LIMIT ? OFFSET ?""",
            (limit, offset),
        ).fetchall()
        total = conn.execute("SELECT COUNT(*) as n FROM matches").fetchone()["n"]
    else:
        rows = conn.execute(
            """SELECT m.*,
                    i.filename as img_filename, i.file_path as img_path,
                    e.filename as excel_filename, e.file_path as excel_path, e.sheet_name,
                    c.filename as cad_filename, c.file_path as cad_path, c.extension as cad_ext,
                    p.filename as pdf_filename, p.file_path as pdf_path, p.page_count
             FROM matches m
             LEFT JOIN images i ON m.img_id = i.img_id
             LEFT JOIN excel_records e ON m.ex_id = e.ex_id
             LEFT JOIN cad_files c ON m.cad_id = c.cad_id
             LEFT JOIN pdf_files p ON m.pdf_id = p.doc_id
             WHERE m.status = ?
             ORDER BY m.updated_at DESC LIMIT ? OFFSET ?""",
            (status, limit, offset),
        ).fetchall()
        total = conn.execute("SELECT COUNT(*) as n FROM matches WHERE status = ?", (status,)).fetchone()["n"]

    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def _list_unmatched(limit: int, offset: int):
    """List images that have no match records."""
    conn = get_connection()
    rows = conn.execute(
        """SELECT i.img_id, i.file_path, i.folder, i.filename, i.source_type,
                  i.size_bytes, i.width, i.height, i.tags, i.favorite, i.indexed_at
           FROM images i
           LEFT JOIN matches m ON i.img_id = m.img_id
           WHERE m.id IS NULL
           ORDER BY i.indexed_at DESC LIMIT ? OFFSET ?""",
        (limit, offset),
    ).fetchall()
    total = conn.execute(
        """SELECT COUNT(*) as n FROM images i
           LEFT JOIN matches m ON i.img_id = m.img_id
           WHERE m.id IS NULL"""
    ).fetchone()["n"]

    return {
        "items": [dict(r) for r in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


def _get_stats():
    conn = get_connection()
    auto = conn.execute("SELECT COUNT(*) as n FROM matches WHERE status = 'auto'").fetchone()["n"]
    suspected = conn.execute("SELECT COUNT(*) as n FROM matches WHERE status = 'suspected'").fetchone()["n"]
    confirmed = conn.execute("SELECT COUNT(*) as n FROM matches WHERE status = 'confirmed'").fetchone()["n"]
    rejected = conn.execute("SELECT COUNT(*) as n FROM matches WHERE status = 'rejected'").fetchone()["n"]
    unmatched = conn.execute(
        """SELECT COUNT(*) as n FROM images i
           LEFT JOIN matches m ON i.img_id = m.img_id
           WHERE m.id IS NULL"""
    ).fetchone()["n"]
    total = conn.execute("SELECT COUNT(*) as n FROM matches").fetchone()["n"]

    return {
        "auto": auto,
        "suspected": suspected,
        "confirmed": confirmed,
        "rejected": rejected,
        "unmatched": unmatched,
        "total": total,
    }


def _confirm(id: int):
    if not id:
        raise ValueError("id is required")
    conn = get_connection()
    conn.execute(
        "UPDATE matches SET status = 'confirmed', updated_at = datetime('now','localtime') WHERE id = ?",
        (id,),
    )
    conn.commit()
    return {"ok": True, "id": id, "status": "confirmed"}


def _reject(id: int):
    if not id:
        raise ValueError("id is required")
    conn = get_connection()
    conn.execute(
        "UPDATE matches SET status = 'rejected', updated_at = datetime('now','localtime') WHERE id = ?",
        (id,),
    )
    conn.commit()
    return {"ok": True, "id": id, "status": "rejected"}


def _bind(params: dict):
    img_id = params.get("img_id", "")
    ex_id = params.get("ex_id") or None
    cad_id = params.get("cad_id") or None
    pdf_id = params.get("pdf_id") or None
    method = params.get("method", "manual-bind")
    confidence = params.get("confidence", "1.0")

    if not img_id:
        raise ValueError("img_id is required")
    if not any([ex_id, cad_id, pdf_id]):
        raise ValueError("At least one of ex_id, cad_id, pdf_id is required")

    conn = get_connection()

    # Check for existing match on same entities
    existing = conn.execute(
        "SELECT id FROM matches WHERE img_id = ? AND (ex_id = ? OR cad_id = ? OR pdf_id = ?)",
        (img_id, ex_id, cad_id, pdf_id),
    ).fetchone()

    if existing:
        conn.execute(
            """UPDATE matches SET status = 'confirmed', method = ?, confidence = ?,
               updated_at = datetime('now','localtime') WHERE id = ?""",
            (method, confidence, existing["id"]),
        )
        conn.commit()
        return {"ok": True, "id": existing["id"], "status": "confirmed", "updated": True}

    conn.execute(
        """INSERT INTO matches (img_id, ex_id, cad_id, pdf_id, status, method, confidence)
           VALUES (?, ?, ?, ?, 'confirmed', ?, ?)""",
        (img_id, ex_id, cad_id, pdf_id, method, confidence),
    )
    conn.commit()

    new_id = conn.execute("SELECT last_insert_rowid() as id").fetchone()["id"]
    return {"ok": True, "id": new_id, "status": "confirmed", "created": True}
