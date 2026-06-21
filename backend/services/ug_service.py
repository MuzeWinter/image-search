"""UG NXOpen preview extraction service.

Recursively finds .prt files, extracts preview images via NXOpen API,
deduplicates by SHA256, writes to images table.

Runnable standalone: python ug_service.py --path ./test-data
"""

import sys
import os
import hashlib
import time
import argparse
import json
from pathlib import Path

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from backend.db.connection import get_connection

NXOPEN_AVAILABLE = False
try:
    import NXOpen
    NXOPEN_AVAILABLE = True
except ImportError:
    pass


def sha256_file(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while True:
            chunk = f.read(65536)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def find_prt_files(root_path: str) -> list:
    prt_files = []
    for root, dirs, files in os.walk(root_path):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for f in files:
            if not f.startswith('.') and not f.startswith('~') and f.lower().endswith('.prt'):
                prt_files.append(os.path.join(root, f))
    return prt_files


def _extract_preview_nx(prt_path: str, output_path: str) -> bool:
    """Use NXOpen to open a .prt and export a preview image. Returns True on success."""
    try:
        session = NXOpen.Session.GetSession()
        part = session.Parts.Open(prt_path)

        export_builder = session.Parts.Work.Create.ImageExportBuilder()
        export_builder.RegionMode = NXOpen.ImageExportBuilder.RegionModeType.WorkView
        export_builder.FileFormat = NXOpen.ImageExportBuilder.FileFormatType.Png
        export_builder.ExportFileName = output_path

        nXObject = export_builder.Commit()
        export_builder.Destroy()

        part.Close(
            getattr(NXOpen.BasePart.CloseWholeTree, 'False'),
            NXOpen.BasePart.CloseModified.UseResponses
        )
        return True
    except Exception as e:
        sys.stderr.write(f"[ug] NXOpen export failed {prt_path}: {e}\n")
        sys.stderr.flush()
        return False


def process_directory(root_path: str, progress_cb=None) -> dict:
    start_time = time.time()
    p = Path(root_path)

    if not p.exists():
        return {"error": f"Path does not exist: {root_path}", "prt_count": 0, "extracted": 0, "skipped": 0, "duration_sec": 0, "nxopen_available": NXOPEN_AVAILABLE}
    if not p.is_dir():
        return {"error": f"Path is not a directory: {root_path}", "prt_count": 0, "extracted": 0, "skipped": 0, "duration_sec": 0, "nxopen_available": NXOPEN_AVAILABLE}

    prt_files = find_prt_files(root_path)
    prt_count = len(prt_files)

    if prt_count == 0:
        return {"prt_count": 0, "extracted": 0, "skipped": 0, "duration_sec": 0, "nxopen_available": NXOPEN_AVAILABLE}

    if not NXOPEN_AVAILABLE:
        sys.stderr.write(f"[ug] NXOpen not available, skipping {prt_count} .prt file(s) in {root_path}\n")
        sys.stderr.flush()
        return {"prt_count": prt_count, "extracted": 0, "skipped": prt_count, "duration_sec": round(time.time() - start_time, 2), "nxopen_available": False}

    preview_dir = os.path.join(_PROJECT_ROOT, "backend", "data", "ug_previews")
    os.makedirs(preview_dir, exist_ok=True)

    conn = get_connection()
    now = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    extracted = 0
    skipped = 0
    seen_hashes = set()

    for i, prt_path in enumerate(prt_files):
        if progress_cb:
            progress_cb("ug_preview", i + 1, prt_count, prt_path)

        try:
            prt_hash = sha256_file(prt_path)
        except (PermissionError, OSError) as e:
            sys.stderr.write(f"[ug] cannot read {prt_path}: {e}\n")
            sys.stderr.flush()
            skipped += 1
            continue

        if prt_hash in seen_hashes:
            sys.stderr.write(f"[ug] duplicate hash skip: {prt_path}\n")
            sys.stderr.flush()
            skipped += 1
            continue
        seen_hashes.add(prt_hash)

        max_row = conn.execute(
            "SELECT img_id FROM images WHERE img_id LIKE 'UG-%' ORDER BY img_id DESC LIMIT 1"
        ).fetchone()
        if max_row:
            last_num = int(max_row["img_id"].split("-")[1])
            img_id = f"UG-{last_num + 1:06d}"
        else:
            img_id = "UG-000001"

        ug_ref = os.path.splitext(os.path.basename(prt_path))[0]
        preview_path = os.path.join(preview_dir, f"{img_id}.png")

        try:
            if _extract_preview_nx(prt_path, preview_path):
                if os.path.exists(preview_path) and os.path.getsize(preview_path) > 0:
                    preview_hash = sha256_file(preview_path)
                    conn.execute(
                        """INSERT OR REPLACE INTO images
                           (img_id, source_type, image_path, origin_path, sheet_name, row_number, ug_ref, vector_id, file_hash, indexed_at)
                           VALUES (?, 'ug-preview', ?, ?, NULL, NULL, ?, NULL, ?, ?)""",
                        (img_id, preview_path, prt_path, ug_ref, preview_hash, now)
                    )
                    extracted += 1
                else:
                    skipped += 1
            else:
                skipped += 1
        except Exception as e:
            sys.stderr.write(f"[ug] processing error {prt_path}: {e}\n")
            sys.stderr.flush()
            skipped += 1

    conn.commit()
    duration = round(time.time() - start_time, 2)

    return {"prt_count": prt_count, "extracted": extracted, "skipped": skipped, "duration_sec": duration, "nxopen_available": True}


def execute(method: str, params: dict):
    if method == "ug.scan":
        return process_directory(params.get("path", ""), params.get("progress_cb"))
    elif method == "ug.status":
        return {"nxopen_available": NXOPEN_AVAILABLE}
    else:
        raise ValueError(f"Unknown ug method: {method}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ZOOBET UG NXOpen preview extraction")
    parser.add_argument("--path", required=True, help="Root directory to scan for .prt files")
    parser.add_argument("--json", action="store_true", help="Output result as JSON")
    args = parser.parse_args()

    result = process_directory(args.path)

    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(f"NXOpen available: {result.get('nxopen_available', False)}")
        print(f"PRT files found: {result.get('prt_count', 0)}")
        print(f"Previews extracted: {result.get('extracted', 0)}")
        print(f"Skipped: {result.get('skipped', 0)}")
        print(f"Duration: {result.get('duration_sec', 0)}s")
        if "error" in result:
            print(f"Error: {result['error']}")
