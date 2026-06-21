"""UG NXOpen preview extraction service.

Recursively finds .prt files, extracts preview images via NXOpen API,
deduplicates by SHA256, writes to images table.

Features:
- Batch extraction with directory recursive scanning
- Progress callback / status reporting
- Graceful degradation when NXOpen unavailable (file metadata fallback)
- Cache by file_hash to avoid duplicate extraction
- Breakpoint resume (checkpoint file)
- Per-file timeout protection (default 60s)

Runnable standalone: python ug_service.py --path ./test-data
"""

import sys
import os
import hashlib
import time
import argparse
import json
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FutureTimeoutError

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


# ── Cache ────────────────────────────────────────────────────────────────

def _lookup_cache(conn, file_hash: str) -> dict | None:
    """Return cached preview record if one exists for this file_hash, else None.

    Matches both full previews and metadata-only records — any prior processing
    of this file_hash counts as a cache hit.
    """
    row = conn.execute(
        "SELECT img_id, image_path, status FROM images WHERE file_hash = ? AND source_type = 'ug-preview' LIMIT 1",
        (file_hash,)
    ).fetchone()
    if row is None:
        return None
    preview_path = row["image_path"]
    status = row["status"] or ""
    # Metadata-only records have no preview file — still a valid cache hit
    if status == "metadata-only":
        return {"img_id": row["img_id"], "image_path": None, "metadata_only": True}
    if preview_path and os.path.exists(preview_path) and os.path.getsize(preview_path) > 0:
        return {"img_id": row["img_id"], "image_path": preview_path, "metadata_only": False}
    return None


# ── Checkpoint ───────────────────────────────────────────────────────────

def _checkpoint_dir():
    d = os.path.join(_PROJECT_ROOT, "backend", "data", "ug_checkpoints")
    os.makedirs(d, exist_ok=True)
    return d


def _checkpoint_path(root_path: str) -> str:
    """Deterministic checkpoint file path for a given root directory."""
    path_hash = hashlib.sha256(root_path.encode()).hexdigest()[:16]
    return os.path.join(_checkpoint_dir(), f"ckpt_{path_hash}.json")


def _load_checkpoint(root_path: str) -> dict:
    cp_path = _checkpoint_path(root_path)
    if os.path.exists(cp_path):
        try:
            with open(cp_path, "r", encoding="utf-8") as f:
                data: dict = json.load(f)
                return data
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def _save_checkpoint(root_path: str, data: dict):
    cp_path = _checkpoint_path(root_path)
    data["updated_at"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    try:
        with open(cp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except OSError as e:
        sys.stderr.write(f"[ug] checkpoint write error: {e}\n")
        sys.stderr.flush()


def _clear_checkpoint(root_path: str):
    cp_path = _checkpoint_path(root_path)
    if os.path.exists(cp_path):
        try:
            os.remove(cp_path)
        except OSError:
            pass


# ── Timeout wrapper ─────────────────────────────────────────────────────

def _extract_with_timeout(prt_path: str, output_path: str, timeout_sec: int = 60) -> tuple:
    """Run _extract_preview_nx in a thread with timeout. Returns (success: bool, error: str)."""
    result_holder: dict = {"ok": False, "error": ""}

    def _target():
        try:
            ok = _extract_preview_nx(prt_path, output_path)
            result_holder["ok"] = ok
        except Exception as e:
            result_holder["error"] = str(e)

    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(_target)
    try:
        future.result(timeout=timeout_sec)
    except FutureTimeoutError:
        executor.shutdown(wait=False, cancel_futures=True)
        return False, f"timeout after {timeout_sec}s"
    finally:
        executor.shutdown(wait=False)

    return result_holder["ok"], result_holder["error"]


# ── NXOpen extraction ───────────────────────────────────────────────────

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


# ── Metadata fallback ──────────────────────────────────────────────────

def _insert_metadata_record(conn, prt_path: str, file_hash: str, ug_ref: str,
                            prev_max_num: int) -> str:
    """Insert a metadata-only record when NXOpen is unavailable or extraction fails.
    Returns the generated img_id."""
    img_id = f"UG-{prev_max_num + 1:06d}"
    try:
        file_size = os.path.getsize(prt_path)
    except OSError:
        file_size = 0
    try:
        mtime = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(os.path.getmtime(prt_path)))
    except OSError:
        mtime = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    now = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    folder = os.path.dirname(prt_path)
    filename = os.path.basename(prt_path)

    conn.execute(
        """INSERT OR REPLACE INTO images
           (img_id, source_type, file_path, image_path, origin_path, folder, filename,
            size_bytes, sheet_name, row_number, ug_ref, cad_ref, pdf_ref, vector_id,
            file_hash, status, last_modified, indexed_at)
           VALUES (?, 'ug-preview', ?, NULL, ?, ?, ?, ?, NULL, NULL, ?, NULL, NULL, NULL,
                   ?, 'metadata-only', ?, ?)""",
        (img_id, prt_path, prt_path, folder, filename, file_size,
         ug_ref, file_hash, mtime, now)
    )
    return img_id


# ── Main pipeline ───────────────────────────────────────────────────────

def process_directory(root_path: str, progress_cb=None, *,
                      use_cache: bool = True,
                      resume: bool = True,
                      timeout_sec: int = 60,
                      force: bool = False) -> dict:
    """Scan root_path recursively for .prt files and extract preview images.

    Parameters:
        progress_cb:  callback(phase, current, total, current_file) for progress
        use_cache:    skip files whose hash already has a preview in DB
        resume:       save/load checkpoint to resume interrupted scans
        timeout_sec:  max seconds per NXOpen extraction (0 = no timeout)
        force:        ignore cache and checkpoint, re-extract everything
    """
    start_time = time.time()
    p = Path(root_path)

    if not p.exists():
        return {"error": f"Path does not exist: {root_path}", "prt_count": 0,
                "extracted": 0, "skipped": 0, "cached": 0, "metadata_only": 0,
                "duration_sec": 0, "nxopen_available": NXOPEN_AVAILABLE}
    if not p.is_dir():
        return {"error": f"Path is not a directory: {root_path}", "prt_count": 0,
                "extracted": 0, "skipped": 0, "cached": 0, "metadata_only": 0,
                "duration_sec": 0, "nxopen_available": NXOPEN_AVAILABLE}

    prt_files = find_prt_files(root_path)
    prt_files.sort()
    prt_count = len(prt_files)

    if prt_count == 0:
        return {"prt_count": 0, "extracted": 0, "skipped": 0, "cached": 0,
                "metadata_only": 0, "duration_sec": 0, "nxopen_available": NXOPEN_AVAILABLE}

    preview_dir = os.path.join(_PROJECT_ROOT, "backend", "data", "ug_previews")
    os.makedirs(preview_dir, exist_ok=True)

    conn = get_connection()

    # Determine starting index from checkpoint
    start_index = 0
    checkpoint = {}
    if resume and not force:
        checkpoint = _load_checkpoint(root_path)
        if (checkpoint.get("root_path") == root_path
                and checkpoint.get("prt_count") == prt_count
                and checkpoint.get("processed_count", 0) < prt_count):
            start_index = checkpoint.get("processed_count", 0)
            sys.stderr.write(
                f"[ug] resuming from checkpoint: {start_index}/{prt_count}\n")
            sys.stderr.flush()

    # Progress reporting helpers
    def _emit_progress(current: int, current_file: str = ""):
        if progress_cb:
            progress_cb("ug_preview", current, prt_count, current_file)

    now = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    extracted = 0
    skipped = 0
    cached = 0
    metadata_only = 0
    seen_hashes: set = set()
    last_processed_num = 0

    # Find last used UG number
    max_row = conn.execute(
        "SELECT img_id FROM images WHERE img_id LIKE 'UG-%' ORDER BY img_id DESC LIMIT 1"
    ).fetchone()
    if max_row:
        last_processed_num = int(max_row["img_id"].split("-")[1])
    else:
        last_processed_num = 0

    for i in range(start_index, prt_count):
        prt_path = prt_files[i]
        _emit_progress(i + 1, prt_path)

        # File hash
        try:
            prt_hash = sha256_file(prt_path)
        except (PermissionError, OSError) as e:
            sys.stderr.write(f"[ug] cannot read {prt_path}: {e}\n")
            sys.stderr.flush()
            skipped += 1
            continue

        # Dedup within current batch
        if prt_hash in seen_hashes:
            sys.stderr.write(f"[ug] duplicate hash skip: {prt_path}\n")
            sys.stderr.flush()
            skipped += 1
            continue
        seen_hashes.add(prt_hash)

        # Cache lookup
        if use_cache and not force:
            cached_record = _lookup_cache(conn, prt_hash)
            if cached_record is not None:
                sys.stderr.write(
                    f"[ug] cache hit: {prt_path} -> {cached_record['img_id']}\n")
                sys.stderr.flush()
                cached += 1
                continue

        ug_ref = os.path.splitext(os.path.basename(prt_path))[0]

        if not NXOPEN_AVAILABLE:
            # Graceful degradation: metadata-only record
            last_processed_num += 1
            img_id = _insert_metadata_record(
                conn, prt_path, prt_hash, ug_ref, last_processed_num - 1)
            sys.stderr.write(
                f"[ug] metadata fallback (NXOpen not available): {prt_path} -> {img_id}\n")
            sys.stderr.flush()
            metadata_only += 1
        else:
            # Normal extraction with timeout
            last_processed_num += 1
            img_id = f"UG-{last_processed_num:06d}"
            preview_path = os.path.join(preview_dir, f"{img_id}.png")

            try:
                if timeout_sec > 0:
                    ok, err_msg = _extract_with_timeout(
                        prt_path, preview_path, timeout_sec)
                else:
                    ok = _extract_preview_nx(prt_path, preview_path)
                    err_msg = "" if ok else "extraction returned False"

                if ok and os.path.exists(preview_path) and os.path.getsize(preview_path) > 0:
                    preview_hash = sha256_file(preview_path)
                    file_size = os.path.getsize(prt_path)
                    folder = os.path.dirname(prt_path)
                    filename = os.path.basename(prt_path)
                    try:
                        mtime = time.strftime(
                            "%Y-%m-%d %H:%M:%S",
                            time.localtime(os.path.getmtime(prt_path)))
                    except OSError:
                        mtime = now
                    conn.execute(
                        """INSERT OR REPLACE INTO images
                           (img_id, source_type, file_path, image_path, origin_path,
                            folder, filename, size_bytes, sheet_name, row_number,
                            ug_ref, vector_id, file_hash, indexed_at)
                           VALUES (?, 'ug-preview', ?, ?, ?, ?, ?, ?, NULL, NULL,
                                   ?, NULL, ?, ?)""",
                        (img_id, prt_path, preview_path, prt_path, folder, filename,
                         file_size, ug_ref, preview_hash, now)
                    )
                    extracted += 1
                else:
                    # Extraction failed — metadata fallback
                    _insert_metadata_record(
                        conn, prt_path, prt_hash, ug_ref, last_processed_num - 1)
                    if err_msg:
                        sys.stderr.write(
                            f"[ug] extraction failed, metadata fallback: {prt_path} ({err_msg})\n")
                    else:
                        sys.stderr.write(
                            f"[ug] extraction failed (empty/missing output), metadata fallback: {prt_path}\n")
                    sys.stderr.flush()
                    metadata_only += 1
            except Exception as e:
                sys.stderr.write(f"[ug] processing error {prt_path}: {e}\n")
                sys.stderr.flush()
                skipped += 1

        # Save checkpoint periodically (every 10 files)
        if resume and not force and (i + 1) % 10 == 0:
            _save_checkpoint(root_path, {
                "root_path": root_path,
                "started_at": checkpoint.get("started_at", now),
                "prt_count": prt_count,
                "processed_count": i + 1,
                "last_processed_path": prt_path,
            })

    # Commit all changes
    conn.commit()

    # Clear checkpoint on successful completion
    if resume and not force:
        _clear_checkpoint(root_path)

    duration = round(time.time() - start_time, 2)

    return {
        "prt_count": prt_count,
        "extracted": extracted,
        "skipped": skipped,
        "cached": cached,
        "metadata_only": metadata_only,
        "duration_sec": duration,
        "nxopen_available": NXOPEN_AVAILABLE,
    }


# ── JSON-RPC dispatch ──────────────────────────────────────────────────

def execute(method: str, params: dict):
    if method == "ug.scan":
        path = params.get("path", "")
        use_cache = params.get("use_cache", True)
        resume = params.get("resume", True)
        timeout_sec = params.get("timeout_sec", 60)
        force = params.get("force", False)
        return process_directory(
            path, params.get("progress_cb"),
            use_cache=use_cache,
            resume=resume,
            timeout_sec=timeout_sec,
            force=force,
        )
    elif method == "ug.status":
        return {"nxopen_available": NXOPEN_AVAILABLE}
    elif method == "ug.clear_checkpoint":
        _clear_checkpoint(params.get("path", ""))
        return {"ok": True}
    else:
        raise ValueError(f"Unknown ug method: {method}")


# ── Standalone CLI ─────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ZOOBET UG NXOpen preview extraction")
    parser.add_argument("--path", required=True,
                        help="Root directory to scan for .prt files")
    parser.add_argument("--json", action="store_true",
                        help="Output result as JSON")
    parser.add_argument("--no-cache", action="store_true",
                        help="Disable preview cache lookup")
    parser.add_argument("--no-resume", action="store_true",
                        help="Disable checkpoint resume")
    parser.add_argument("--timeout", type=int, default=60,
                        help="Per-file extraction timeout in seconds (0 = no limit)")
    parser.add_argument("--force", action="store_true",
                        help="Force re-extraction (ignore cache and checkpoint)")
    args = parser.parse_args()

    result = process_directory(
        args.path,
        use_cache=not args.no_cache,
        resume=not args.no_resume,
        timeout_sec=args.timeout,
        force=args.force,
    )

    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    else:
        print(f"NXOpen available: {result.get('nxopen_available', False)}")
        print(f"PRT files found:  {result.get('prt_count', 0)}")
        print(f"Previews extracted: {result.get('extracted', 0)}")
        print(f"Cache hits:        {result.get('cached', 0)}")
        print(f"Metadata-only:     {result.get('metadata_only', 0)}")
        print(f"Skipped:           {result.get('skipped', 0)}")
        print(f"Duration:          {result.get('duration_sec', 0)}s")
        if "error" in result:
            print(f"Error: {result['error']}")
