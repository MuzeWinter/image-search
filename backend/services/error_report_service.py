"""Error report generator — collects diagnostics and creates a .zip report

Can be imported as a JSON-RPC service module or run as a standalone CLI script.
"""

import sys
import os
import json
import datetime
import zipfile
import tempfile
import shutil
import traceback
from pathlib import Path


def execute(method: str, params: dict):
    if method == "errorReport.generate":
        trigger = params.get("trigger", "manual")
        context = params.get("context", "")
        return generate_report(trigger, context)
    raise ValueError(f"Unknown errorReport method: {method}")


def generate_report(trigger="manual", context="", db_available=True):
    ts = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    report_name = f"zoobet-error-report-{ts}"

    docs_dir = Path.home() / "Documents"
    docs_dir.mkdir(parents=True, exist_ok=True)
    zip_path = docs_dir / f"{report_name}.zip"

    tmp_dir = Path(tempfile.mkdtemp(prefix="zoobet-report-"))
    files_written = []

    try:
        _write_file(tmp_dir / "system_info.txt", _collect_system_info(trigger, context))
        files_written.append("system_info.txt")
    except Exception as e:
        _write_file(tmp_dir / "system_info.txt", f"Failed to collect system info: {e}")

    try:
        diag = _collect_diagnostics()
        _write_file(tmp_dir / "diagnostics.json", json.dumps(diag, indent=2, ensure_ascii=False))
        files_written.append("diagnostics.json")
    except Exception as e:
        _write_file(tmp_dir / "diagnostics.json", json.dumps({"error": str(e)}, indent=2))

    try:
        deps_text = _collect_dependency_versions()
        _write_file(tmp_dir / "dependencies.txt", deps_text)
        files_written.append("dependencies.txt")
    except Exception as e:
        _write_file(tmp_dir / "dependencies.txt", f"Failed to collect dependency info: {e}")

    try:
        if db_available:
            logs_text = _collect_recent_logs()
            _write_file(tmp_dir / "recent_logs.txt", logs_text)
            files_written.append("recent_logs.txt")
    except Exception as e:
        _write_file(tmp_dir / "recent_logs.txt", f"Failed to read logs: {e}")

    _write_file(tmp_dir / "error_context.txt",
                f"Trigger: {trigger}\nTimestamp: {datetime.datetime.now().isoformat()}\nContext: {context}\n")
    files_written.append("error_context.txt")

    try:
        with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
            for fname in files_written:
                zf.write(tmp_dir / fname, fname)
    except Exception as e:
        return {"ok": False, "error": f"Failed to create zip: {e}"}

    shutil.rmtree(tmp_dir, ignore_errors=True)

    return {
        "ok": True,
        "path": str(zip_path),
        "name": report_name,
        "files": files_written,
    }


def _collect_system_info(trigger, context):
    lines = [
        "ZOOBET Error Report",
        f"Generated: {datetime.datetime.now().isoformat()}",
        f"Trigger: {trigger}",
        f"Context: {context}",
        "",
        "--- System ---",
        f"Platform: {sys.platform}",
        f"Python Version: {sys.version}",
        f"Python Executable: {sys.executable}",
        f"Architecture: {'64-bit' if sys.maxsize > 2**32 else '32-bit'}",
    ]

    try:
        import platform
        lines += [
            f"OS: {platform.system()} {platform.release()}",
            f"OS Version: {platform.version()}",
            f"Machine: {platform.machine()}",
            f"Processor: {platform.processor()}",
            f"Hostname: {platform.node()}",
        ]
    except Exception:
        pass

    return "\n".join(lines)


def _collect_dependency_versions():
    lines = ["--- Python Dependencies ---"]
    deps = [
        ("torch", "PyTorch"),
        ("open_clip", "OpenCLIP"),
        ("faiss", "FAISS"),
        ("numpy", "NumPy"),
        ("PIL", "Pillow"),
        ("easyocr", "EasyOCR"),
        ("nxopen", "NXOpen"),
    ]
    for module_name, label in deps:
        try:
            mod = __import__(module_name)
            ver = getattr(mod, "__version__", "installed (no __version__)")
            lines.append(f"  {label} ({module_name}): {ver}")
        except ImportError:
            lines.append(f"  {label} ({module_name}): NOT INSTALLED")
        except Exception as e:
            lines.append(f"  {label} ({module_name}): error checking - {e}")

    return "\n".join(lines)


def _collect_diagnostics():
    try:
        from backend.services.system_service import _run_diagnostics
        return _run_diagnostics()
    except Exception as e:
        return {"error": f"Diagnostics collection failed: {e}"}


def _collect_recent_logs():
    try:
        from backend.db.connection import get_connection
        conn = get_connection()
        rows = conn.execute(
            "SELECT id, level, source, message, created_at FROM activity_logs ORDER BY id DESC LIMIT 100"
        ).fetchall()
        if not rows:
            return "(no activity logs)"
        lines = []
        for row in reversed(rows):
            lines.append(f"[{row['created_at']}] [{row['level'].upper()}] {row['source']}: {row['message']}")
        return "\n".join(lines)
    except Exception as e:
        return f"Failed to read activity logs: {e}"


def _write_file(path, content):
    path.write_text(content, encoding="utf-8")


if __name__ == "__main__":
    # Standalone mode: called by Rust panic hook or startup failure detector
    _PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if _PROJECT_ROOT not in sys.path:
        sys.path.insert(0, _PROJECT_ROOT)

    import argparse
    parser = argparse.ArgumentParser(description="ZOOBET Error Report Generator")
    parser.add_argument("--trigger", default="manual", help="Trigger type (panic, startup-failure, db-corruption, manual)")
    parser.add_argument("--context", default="", help="Additional error context")
    parser.add_argument("--no-db", action="store_true", help="Skip database-dependent collections")
    args = parser.parse_args()

    result = generate_report(
        trigger=args.trigger,
        context=args.context,
        db_available=not args.no_db,
    )
    print(json.dumps(result, ensure_ascii=False))
