"""File scan engine - recursive scan, SHA256 dedup, category stats, change detection.

Runnable as standalone script: python scan_service.py --library-id 1 --path /target/dir
Outputs progress JSON lines to stdout, final result as last line.
"""

import sys
import os
import json
import hashlib
import time
import argparse
from pathlib import Path

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from backend.db.connection import get_connection

EXCEL_EXT = {'.xlsx', '.xls', '.xlsm', '.xlsb'}
IMAGE_EXT = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp', '.svg', '.ico', '.heic', '.heif'}
CAD_EXT = {'.dwg', '.dxf', '.step', '.stp', '.iges', '.igs', '.prt', '.asm',
           '.sldprt', '.sldasm', '.catpart', '.catproduct', '.ipt', '.iam', '.stl', '.obj'}
PDF_EXT = {'.pdf'}


def classify_file(ext: str) -> str:
    e = ext.lower()
    if e in EXCEL_EXT: return "excel"
    if e in IMAGE_EXT: return "image"
    if e in CAD_EXT: return "cad"
    if e in PDF_EXT: return "pdf"
    return "other"


def sha256_file(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def emit_progress(phase: str, current: int, total: int, current_file: str = ""):
    payload = {
        "type": "progress",
        "phase": phase,
        "current": current,
        "total": total,
        "current_file": current_file,
        "percent": int(current / max(total, 1) * 100)
    }
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def emit_result(result: dict):
    result["type"] = "result"
    sys.stdout.write(json.dumps(result, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _insert_image_record(conn, filepath: str, info: dict):
    folder = os.path.dirname(filepath)
    filename = os.path.basename(filepath)
    now = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    mtime = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(os.path.getmtime(filepath)))

    conn.execute(
        """INSERT OR REPLACE INTO images
           (img_id, source_type, file_path, folder, filename, size_bytes, width, height, file_hash, status, last_modified, indexed_at)
           VALUES (?, 'file_image', ?, ?, ?, ?, NULL, NULL, ?, 'normal', ?, ?)""",
        (info["hash"], filepath, folder, filename, info["size"], info["hash"], mtime, now)
    )


def _insert_cad_record(conn, filepath: str, info: dict):
    folder = os.path.dirname(filepath)
    filename = os.path.basename(filepath)
    ext = info["ext"].lower().lstrip(".")
    now = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    mtime = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(os.path.getmtime(filepath)))
    cad_id = f"CAD-{info['hash'][:16]}"

    conn.execute(
        """INSERT OR REPLACE INTO cad_files
           (cad_id, file_path, folder, filename, extension, size_bytes, file_hash, status, last_modified, indexed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'normal', ?, ?)""",
        (cad_id, filepath, folder, filename, ext, info["size"], info["hash"], mtime, now)
    )


def _count_pdf_pages(filepath: str) -> int:
    """Quick PDF page count by searching for /Type/Page objects."""
    try:
        import re
        with open(filepath, 'rb') as f:
            content = f.read()
        pages = len(re.findall(b'/Type\s*/Page[^s]', content))
        return pages if pages > 0 else 0
    except Exception:
        return 0


def _insert_pdf_record(conn, filepath: str, info: dict):
    folder = os.path.dirname(filepath)
    filename = os.path.basename(filepath)
    now = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    mtime = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(os.path.getmtime(filepath)))
    doc_id = f"DOC-{info['hash'][:16]}"
    page_count = _count_pdf_pages(filepath)

    conn.execute(
        """INSERT OR REPLACE INTO pdf_files
           (doc_id, file_path, folder, filename, size_bytes, page_count, file_hash, status, last_modified, indexed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'normal', ?, ?)""",
        (doc_id, filepath, folder, filename, info["size"], page_count, info["hash"], mtime, now)
    )


def _extract_excel_images(filepath: str, library_path: str) -> int:
    """Extract embedded images from Excel. Returns count of images extracted."""
    try:
        from openpyxl import load_workbook
    except ImportError:
        sys.stderr.write(f"[scan] openpyxl not installed, skipping Excel images: {filepath}\n")
        return 0

    extracted_dir = os.path.join(_PROJECT_ROOT, "backend", "data", "extracted_images")
    os.makedirs(extracted_dir, exist_ok=True)

    conn = get_connection()
    folder = os.path.dirname(filepath)
    filename = os.path.basename(filepath)
    mtime = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(os.path.getmtime(filepath)))
    now = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())

    wb = load_workbook(filepath, data_only=True)
    count = 0

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        images = getattr(ws, '_images', [])
        if not images:
            continue

        for img in images:
            try:
                pil_img = img.image
                if pil_img is None:
                    continue

                width = pil_img.width
                height = pil_img.height

                # Determine extension from PIL image format
                fmt = pil_img.format if pil_img.format else "PNG"
                ext = fmt.lower()
                if ext == "jpeg":
                    ext = "jpg"

                # Generate sequential IMG ID
                max_row = conn.execute(
                    "SELECT img_id FROM images WHERE img_id LIKE 'IMG-%' ORDER BY img_id DESC LIMIT 1"
                ).fetchone()
                if max_row:
                    last_num = int(max_row["img_id"].split("-")[1])
                    img_id = f"IMG-{last_num + 1:06d}"
                else:
                    img_id = "IMG-000001"

                # Save image file
                img_filename = f"{img_id}.{ext}"
                img_path = os.path.join(extracted_dir, img_filename)
                pil_img.save(img_path, format=fmt)

                img_size = os.path.getsize(img_path)
                cell_ref = str(img.anchor) if hasattr(img, 'anchor') else ''

                conn.execute(
                    """INSERT OR REPLACE INTO images
                       (img_id, source_type, file_path, folder, filename, size_bytes, width, height, file_hash, ex_ref, status, last_modified, indexed_at)
                       VALUES (?, 'excel_embedded', ?, ?, ?, ?, ?, ?, ?, ?, 'normal', ?, ?)""",
                    (img_id, filepath, folder, img_filename, img_size, width, height, None, cell_ref, mtime, now)
                )

                count += 1
            except Exception as e:
                sys.stderr.write(f"[scan] excel image extract error: {filepath} sheet={sheet_name}: {e}\n")
                sys.stderr.flush()
                continue

    wb.close()
    return count


def _log_change(conn, change_type: str, filepath: str, old_value: str = None, new_value: str = None):
    conn.execute(
        """INSERT INTO change_logs (change_type, file_path, old_value, new_value, status, created_at)
           VALUES (?, ?, ?, ?, 'processed', datetime('now','localtime'))""",
        (change_type, filepath, old_value, new_value)
    )


def scan_library(library_id: int, library_path: str):
    start_time = time.time()
    path = Path(library_path)

    if not path.exists():
        emit_result({"error": f"Path does not exist: {library_path}", "added": 0, "removed": 0,
                     "modified": 0, "moved": 0, "errors": 1, "duration_sec": 0,
                     "total_files": 0, "excel_count": 0, "image_count": 0,
                     "cad_count": 0, "pdf_count": 0, "other_count": 0})
        return

    if not path.is_dir():
        emit_result({"error": f"Path is not a directory: {library_path}", "added": 0, "removed": 0,
                     "modified": 0, "moved": 0, "errors": 1, "duration_sec": 0,
                     "total_files": 0, "excel_count": 0, "image_count": 0,
                     "cad_count": 0, "pdf_count": 0, "other_count": 0})
        return

    # Phase 1: Collect all file paths
    emit_progress("collecting", 0, 0, str(path))
    all_files = []
    try:
        for root, dirs, files in os.walk(path):
            dirs[:] = [d for d in dirs if not d.startswith('.')]
            for f in files:
                if not f.startswith('.') and not f.startswith('~'):
                    all_files.append(os.path.join(root, f))
    except PermissionError as e:
        emit_result({"error": f"Permission denied: {e}", "added": 0, "removed": 0,
                     "modified": 0, "moved": 0, "errors": 1, "duration_sec": 0,
                     "total_files": 0, "excel_count": 0, "image_count": 0,
                     "cad_count": 0, "pdf_count": 0, "other_count": 0})
        return

    total_files = len(all_files)
    if total_files == 0:
        emit_result({"added": 0, "removed": 0, "modified": 0, "moved": 0, "errors": 0,
                     "duration_sec": round(time.time() - start_time, 2),
                     "total_files": 0, "excel_count": 0, "image_count": 0,
                     "cad_count": 0, "pdf_count": 0, "other_count": 0})
        return

    # Phase 2: Hash and classify each file
    current_scan = {}
    stats = {"excel": 0, "image": 0, "cad": 0, "pdf": 0, "other": 0}
    errors = 0

    for i, filepath in enumerate(all_files):
        emit_progress("hashing", i + 1, total_files, filepath)
        ext = os.path.splitext(filepath)[1]
        file_type = classify_file(ext)

        try:
            file_size = os.path.getsize(filepath)
            file_hash = sha256_file(filepath)
            stats[file_type] += 1
            current_scan[filepath] = {
                "hash": file_hash,
                "type": file_type,
                "size": file_size,
                "ext": ext,
            }
        except (PermissionError, OSError) as e:
            errors += 1
            sys.stderr.write(f"[scan] error reading {filepath}: {e}\n")
            sys.stderr.flush()

    # Phase 3: Change detection — query all indexed tables
    emit_progress("comparing", 0, 0, "")
    conn = get_connection()

    prev_map = {}
    for table in ["images", "cad_files", "pdf_files"]:
        prev_rows = conn.execute(
            f"SELECT file_path, file_hash FROM {table} WHERE file_path LIKE ?",
            (library_path + "%",)
        ).fetchall()
        for row in prev_rows:
            prev_map[row["file_path"]] = row["file_hash"]

    prev_paths = set(prev_map.keys())
    curr_paths = set(current_scan.keys())

    added = curr_paths - prev_paths
    removed = prev_paths - curr_paths
    common = curr_paths & prev_paths

    modified = set()
    for p in common:
        if current_scan[p]["hash"] != prev_map[p]:
            modified.add(p)

    # Detect moved/renamed (same hash, different path)
    curr_hash_to_paths = {}
    for p in added:
        h = current_scan[p]["hash"]
        curr_hash_to_paths.setdefault(h, []).append(p)

    prev_hash_to_paths = {}
    for p in removed:
        h = prev_map[p]
        prev_hash_to_paths.setdefault(h, []).append(p)

    moved_pairs = []
    for h, new_paths in list(curr_hash_to_paths.items()):
        if h in prev_hash_to_paths:
            old_paths = prev_hash_to_paths[h]
            for old_p, new_p in zip(old_paths, new_paths):
                moved_pairs.append((old_p, new_p))
                added.discard(new_p)
                removed.discard(old_p)

    move_count = len(moved_pairs)

    # Phase 4: Save to database
    total_to_save = len(added) + len(removed)
    emit_progress("saving", 0, max(total_to_save, 1), "")

    saved = 0
    for i, filepath in enumerate(added):
        info = current_scan[filepath]
        if info["type"] == "image":
            _insert_image_record(conn, filepath, info)
        elif info["type"] == "cad":
            _insert_cad_record(conn, filepath, info)
        elif info["type"] == "pdf":
            _insert_pdf_record(conn, filepath, info)
        saved += 1
        emit_progress("saving", saved, total_to_save, filepath)

    # Remove deleted files from all tables
    for filepath in removed:
        for table in ["images", "cad_files", "pdf_files"]:
            conn.execute(f"DELETE FROM {table} WHERE file_path = ?", (filepath,))
        saved += 1
        emit_progress("saving", saved, total_to_save, filepath)

    # Log changes
    for p in added:
        _log_change(conn, "added", p)
    for p in removed:
        _log_change(conn, "removed", p)
    for p in modified:
        _log_change(conn, "modified", p, old_value=prev_map[p], new_value=current_scan[p]["hash"])
    for old_p, new_p in moved_pairs:
        _log_change(conn, "moved", new_p, old_value=old_p, new_value=new_p)

    # Extract Excel images
    excel_image_count = 0
    for filepath in curr_paths:
        info = current_scan[filepath]
        if info["type"] == "excel":
            try:
                imgs = _extract_excel_images(filepath, library_path)
                excel_image_count += imgs
            except Exception as e:
                sys.stderr.write(f"[scan] excel error {filepath}: {e}\n")
                sys.stderr.flush()

    # Write scan history
    duration = time.time() - start_time
    conn.execute(
        """INSERT INTO scan_history
           (library_id, scan_type, added, removed, modified, moved, errors, duration_sec)
           VALUES (?, 'full', ?, ?, ?, ?, ?, ?)""",
        (library_id, len(added), len(removed), len(modified), move_count, errors, int(duration))
    )

    # Update library record
    conn.execute(
        """UPDATE libraries SET
           file_count = ?, image_count = ?, last_scan = datetime('now','localtime'), status = 'ready'
           WHERE id = ?""",
        (total_files, stats["image"] + excel_image_count, library_id)
    )
    conn.commit()

    emit_result({
        "added": len(added),
        "removed": len(removed),
        "modified": len(modified),
        "moved": move_count,
        "errors": errors,
        "duration_sec": round(duration, 2),
        "total_files": total_files,
        "excel_count": stats["excel"],
        "image_count": stats["image"],
        "cad_count": stats["cad"],
        "pdf_count": stats["pdf"],
        "other_count": stats["other"],
    })


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ZOOBET file scan engine")
    parser.add_argument("--library-id", type=int, required=True)
    parser.add_argument("--path", required=True)
    args = parser.parse_args()
    scan_library(args.library_id, args.path)
