"""System diagnostics service — environment & dependency health checks"""

import sys
import os
import shutil
import sqlite3
from backend.db.connection import get_connection, get_db_path


def execute(method: str, params: dict):
    if method == "system.diagnostics":
        return _run_diagnostics()
    raise ValueError(f"Unknown system method: {method}")


def _run_diagnostics():
    checks = []

    # 1. Python environment
    checks.append(_check_python())

    # 2. pip dependencies
    checks += _check_dependencies()

    # 3. Database
    checks += _check_database()

    # 4. Disk space
    checks.append(_check_disk())

    # 5. NXOpen
    checks.append(_check_nxopen())

    # 6. FAISS index
    checks.append(_check_faiss_index())

    all_ok = all(c["status"] == "ok" for c in checks)
    return {
        "ok": all_ok,
        "checks": checks,
        "summary": {
            "total": len(checks),
            "passed": sum(1 for c in checks if c["status"] == "ok"),
            "failed": sum(1 for c in checks if c["status"] == "error"),
            "warning": sum(1 for c in checks if c["status"] == "warn"),
        },
    }


def _check_python():
    version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    exe = sys.executable
    detail = f"Python {version} — {exe}"
    if sys.version_info < (3, 9):
        return {
            "name": "Python",
            "status": "error",
            "detail": detail,
            "suggestion": "Python 3.9+ required. Upgrade your Python installation.",
        }
    return {"name": "Python", "status": "ok", "detail": detail}


def _check_dependencies():
    deps = [
        ("torch", "PyTorch — AI model inference"),
        ("open_clip", "OpenCLIP — vision model"),
        ("faiss", "FAISS — vector similarity search"),
        ("PIL", "Pillow (PIL) — image processing"),
        ("numpy", "NumPy — vector operations"),
    ]
    results = []
    for module_name, label in deps:
        try:
            __import__(module_name)
            results.append({"name": label, "status": "ok", "detail": "Installed"})
        except ImportError:
            results.append({
                "name": label,
                "status": "error",
                "detail": f"Module '{module_name}' not found",
                "suggestion": f"Run: pip install {module_name}",
            })
    return results


def _check_database():
    results = []
    db_path = get_db_path()

    # Check DB file exists
    if not os.path.exists(db_path):
        return [{
            "name": "Database",
            "status": "error",
            "detail": f"Database file not found: {db_path}",
            "suggestion": "Restart the application to reinitialize the database.",
        }]

    # File size
    size_bytes = os.path.getsize(db_path)
    if size_bytes < 1024:
        size_str = f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        size_str = f"{size_bytes / 1024:.1f} KB"
    else:
        size_str = f"{size_bytes / (1024 * 1024):.2f} MB"

    # Table integrity
    try:
        conn = get_connection()
        row = conn.execute("SELECT COUNT(*) as n FROM sqlite_master WHERE type='table'").fetchone()
        table_count = row["n"] if row else 0
        tables = conn.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").fetchall()
        table_names = [t["name"] for t in tables]
        integrity = conn.execute("PRAGMA integrity_check").fetchone()
        integrity_ok = integrity[0] == "ok" if integrity else False

        results.append({
            "name": "Database",
            "status": "ok" if integrity_ok else "error",
            "detail": f"{size_str}, {table_count} tables, integrity: {'OK' if integrity_ok else 'FAILED'}",
            "suggestion": None if integrity_ok else "Database is corrupted. Restore from backup.",
        })

        # Check key tables exist
        required_tables = ["images", "vector_embeddings", "libraries", "settings", "activity_logs"]
        for tbl in required_tables:
            if tbl in table_names:
                count = conn.execute(f"SELECT COUNT(*) as n FROM \"{tbl}\"").fetchone()["n"]
                results.append({
                    "name": f"Table: {tbl}",
                    "status": "ok",
                    "detail": f"{count} rows",
                })
            else:
                results.append({
                    "name": f"Table: {tbl}",
                    "status": "error",
                    "detail": "Table missing",
                    "suggestion": "Table schema may be incomplete. Restore from backup or reinitialize.",
                })

    except Exception as e:
        results.append({
            "name": "Database",
            "status": "error",
            "detail": f"Connection failed: {e}",
            "suggestion": "Check if the database file is accessible and not locked.",
        })

    return results


def _check_disk():
    db_path = get_db_path()
    db_dir = os.path.dirname(db_path)
    try:
        usage = shutil.disk_usage(db_dir)
        free_gb = usage.free / (1024 ** 3)
        total_gb = usage.total / (1024 ** 3)
        detail = f"{free_gb:.1f} GB free / {total_gb:.1f} GB total — {db_dir}"
        if free_gb < 1:
            return {
                "name": "Disk Space",
                "status": "warn",
                "detail": detail,
                "suggestion": "Less than 1 GB free. Consider freeing up disk space.",
            }
        return {"name": "Disk Space", "status": "ok", "detail": detail}
    except Exception as e:
        return {
            "name": "Disk Space",
            "status": "warn",
            "detail": f"Unable to check: {e}",
        }


def _check_nxopen():
    try:
        import nxopen
        return {"name": "NXOpen", "status": "ok", "detail": f"Available — nxopen {getattr(nxopen, '__version__', '')}".strip()}
    except ImportError:
        return {
            "name": "NXOpen",
            "status": "warn",
            "detail": "NXOpen not installed (UG preview extraction limited)",
            "suggestion": "Install NXOpen if you need UG .prt preview extraction.",
        }


def _check_faiss_index():
    try:
        import faiss
        conn = get_connection()
        row = conn.execute("SELECT COUNT(*) as n FROM vector_embeddings").fetchone()
        count = row["n"] if row else 0
        if count > 0:
            return {
                "name": "FAISS Index",
                "status": "ok",
                "detail": f"{count} vectors indexed, FAISS {faiss.__version__}",
            }
        return {
            "name": "FAISS Index",
            "status": "warn",
            "detail": "No vectors indexed yet",
            "suggestion": "Run a scan on your libraries to build the vector index.",
        }
    except ImportError:
        return {
            "name": "FAISS Index",
            "status": "error",
            "detail": "FAISS is not installed",
            "suggestion": "Run: pip install faiss-cpu",
        }
    except Exception as e:
        return {
            "name": "FAISS Index",
            "status": "error",
            "detail": f"Index check failed: {e}",
        }
