"""ZOOBET backend self-check script.

Verifies:
  1. Backend starts and responds to JSON-RPC
  2. Database schema creates all tables
  3. Settings CRUD works
  4. Library CRUD works
  5. Scan engine runs and produces correct output
  6. Database contains expected records after scan

Run: python backend/scripts/verify_backend.py [--test-data ./test-data]
"""

import os
import sys
import json
import subprocess
import time
import argparse
import tempfile
import shutil

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

MAIN_PY = os.path.join(_PROJECT_ROOT, "backend", "main.py")
SCAN_PY = os.path.join(_PROJECT_ROOT, "backend", "services", "scan_service.py")
SEED_PY = os.path.join(_PROJECT_ROOT, "backend", "scripts", "seed_test_data.py")

results = []
failures = 0


def check(name: str, ok: bool, detail: str = ""):
    global failures
    status = "PASS" if ok else "FAIL"
    msg = f"  [{status}] {name}"
    if detail:
        msg += f" — {detail}"
    print(msg)
    results.append({"name": name, "ok": ok, "detail": detail})
    if not ok:
        failures += 1


def rpc_call(proc, method: str, params: dict = None, req_id: int = 1) -> dict:
    """Send a JSON-RPC request to the backend process and return the result."""
    req = {"jsonrpc": "2.0", "id": req_id, "method": method, "params": params or {}}
    proc.stdin.write(json.dumps(req, ensure_ascii=False) + "\n")
    proc.stdin.flush()
    line = proc.stdout.readline()
    if not line:
        return {"error": "no response"}
    try:
        resp = json.loads(line)
    except json.JSONDecodeError as e:
        return {"error": str(e), "raw": line}
    if "error" in resp:
        return {"error": resp["error"].get("message", str(resp["error"]))}
    return {"result": resp.get("result")}


def main():
    global failures

    parser = argparse.ArgumentParser(description="ZOOBET backend verification")
    parser.add_argument("--test-data", default="./test-data", help="Test data directory for scan")
    parser.add_argument("--keep-db", action="store_true", help="Keep the test database after verification")
    args = parser.parse_args()

    test_data_dir = os.path.abspath(args.test_data)

    print("=" * 60)
    print("ZOOBET Backend Verification")
    print("=" * 60)
    print(f"Project root: {_PROJECT_ROOT}")
    print(f"Test data:    {test_data_dir}")
    print()

    # ── 1. Backend startup ────────────────────────────────────────────
    print("── 1. Backend Startup ──")

    if not os.path.exists(MAIN_PY):
        check("main.py exists", False, f"not found at {MAIN_PY}")
        print(f"\n{failures} failure(s). Aborting.")
        sys.exit(1)
    check("main.py exists", True, MAIN_PY)

    # Use a temporary database for testing
    tmp_db_dir = tempfile.mkdtemp(prefix="zoobet_verify_")
    tmp_db_path = os.path.join(tmp_db_dir, "zoobet.db")
    os.environ["ZOOBET_DB_DIR"] = tmp_db_dir

    print(f"  Temp DB dir: {tmp_db_dir}")

    proc = subprocess.Popen(
        [sys.executable, MAIN_PY],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=_PROJECT_ROOT,
    )

    try:
        # Read startup stderr for init message
        time.sleep(0.5)

        resp = rpc_call(proc, "db.init")
        check("db.init responds OK", resp.get("result", {}).get("ok") == True,
              str(resp.get("result")))

        # ── 2. Database schema ─────────────────────────────────────────
        print("\n── 2. Database Schema ──")

        resp = rpc_call(proc, "db.query", {"sql": "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"})
        tables = [r["name"] for r in resp.get("result", [])]
        expected_tables = [
            "cad_files", "change_logs", "excel_records", "images", "libraries",
            "matches", "pdf_files", "scan_history", "search_history", "settings", "vector_embeddings"
        ]
        check("All 11 tables created", all(t in tables for t in expected_tables),
              f"Found {len(tables)} tables")
        missing = [t for t in expected_tables if t not in tables]
        if missing:
            check("No missing tables", False, f"Missing: {missing}")

        resp = rpc_call(proc, "db.getStats")
        stats = resp.get("result", {})
        check("db.getStats returns counts", "libraries" in stats,
              str(stats))

        # ── 3. Settings CRUD ───────────────────────────────────────────
        print("\n── 3. Settings CRUD ──")

        resp = rpc_call(proc, "settings.set", {"key": "test.theme", "value": "dark"})
        check("settings.set", resp.get("result", {}).get("ok") == True)

        resp = rpc_call(proc, "settings.get", {"key": "test.theme"})
        check("settings.get returns value", resp.get("result") == "dark",
              f"got: {resp.get('result')}")

        resp = rpc_call(proc, "settings.getAll")
        all_settings = resp.get("result", {})
        check("settings.getAll includes test key", "test.theme" in all_settings)

        resp = rpc_call(proc, "settings.delete", {"key": "test.theme"})
        check("settings.delete", resp.get("result", {}).get("ok") == True)

        resp = rpc_call(proc, "settings.get", {"key": "test.theme"})
        check("settings.get after delete returns null", resp.get("result") is None,
              f"got: {resp.get('result')}")

        # ── 4. Library CRUD ────────────────────────────────────────────
        print("\n── 4. Library CRUD ──")

        resp = rpc_call(proc, "library.add", {"path": test_data_dir, "label": "Verify Test"})
        lib_result = resp.get("result", {})
        lib_id = lib_result.get("id")
        check("library.add returns id", lib_id is not None, str(lib_result))

        resp = rpc_call(proc, "library.list")
        libs = resp.get("result", [])
        check("library.list includes new library",
              any(l.get("path") == test_data_dir for l in libs))

        resp = rpc_call(proc, "library.get", {"id": lib_id})
        check("library.get returns correct path",
              resp.get("result", {}).get("path") == test_data_dir)

        # ── 5. Scan engine ─────────────────────────────────────────────
        print("\n── 5. Scan Engine ──")

        # Close the RPC process first (scan runs independently)
        proc.stdin.close()
        proc.wait(timeout=5)
        proc = None

        if not os.path.exists(test_data_dir):
            print(f"  Test data dir not found: {test_data_dir}")
            print(f"  Run seed script first: python {SEED_PY} --target {test_data_dir}")
            check("Test data directory exists", False, test_data_dir)
        else:
            file_count = sum(1 for _ in os.walk(test_data_dir) for f in _[2] if not f.startswith('.'))
            check("Test data has files", file_count > 0, f"{file_count} files")

            scan_proc = subprocess.Popen(
                [sys.executable, SCAN_PY, "--library-id", str(lib_id), "--path", test_data_dir],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=_PROJECT_ROOT,
            )

            scan_output = scan_proc.stdout.read()
            scan_proc.wait(timeout=30)

            lines = scan_output.strip().split("\n")
            progress_lines = [l for l in lines if '"type":"progress"' in l or '"type": "progress"' in l]
            result_lines = [l for l in lines if '"type":"result"' in l or '"type": "result"' in l]

            check("Scan emits progress lines", len(progress_lines) > 0,
                  f"{len(progress_lines)} progress lines")
            check("Scan emits result line", len(result_lines) == 1,
                  f"{len(result_lines)} result lines")

            if result_lines:
                result = json.loads(result_lines[0])
                check("Scan result has added > 0", result.get("added", 0) > 0,
                      f"added={result.get('added')}")
                check("Scan result has no errors", result.get("errors", 0) == 0,
                      f"errors={result.get('errors')}")
                check("Scan result classifies images", result.get("image_count", 0) > 0,
                      f"image_count={result.get('image_count')}")
                check("Scan result classifies excel", result.get("excel_count", 0) > 0,
                      f"excel_count={result.get('excel_count')}")

        # ── 6. Database contents after scan ─────────────────────────────
        print("\n── 6. Database Contents After Scan ──")

        # Re-open backend to query scan results
        proc = subprocess.Popen(
            [sys.executable, MAIN_PY],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=_PROJECT_ROOT,
        )

        resp = rpc_call(proc, "db.getStats")
        stats = resp.get("result", {})
        check("images table has records", stats.get("images", 0) > 0,
              str(stats))

        resp = rpc_call(proc, "db.query", {"sql": "SELECT * FROM scan_history ORDER BY id DESC LIMIT 1"})
        sh = resp.get("result", [])
        check("scan_history has entry", len(sh) > 0,
              str(sh[0] if sh else "empty"))

        resp = rpc_call(proc, "db.query", {"sql": "SELECT COUNT(*) as n FROM change_logs"})
        cl = resp.get("result", [])
        check("change_logs has entries", cl[0]["n"] > 0 if cl else False,
              str(cl[0] if cl else "empty"))

        resp = rpc_call(proc, "db.query", {"sql": "SELECT * FROM libraries WHERE id = ?", "params": [lib_id]})
        lib = resp.get("result", [])
        if lib:
            check("library file_count updated", lib[0].get("file_count", 0) > 0,
                  f"file_count={lib[0].get('file_count')}")
            check("library status is ready", lib[0].get("status") == "ready",
                  f"status={lib[0].get('status')}")

    finally:
        if proc is not None:
            proc.stdin.close()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()

        # Clean up temp database
        if not args.keep_db:
            shutil.rmtree(tmp_db_dir, ignore_errors=True)

    # ── Summary ──────────────────────────────────────────────────────
    print("\n" + "=" * 60)
    total = len(results)
    passed = total - failures
    print(f"Results: {passed}/{total} passed, {failures} failed")
    for r in results:
        status = "PASS" if r["ok"] else "FAIL"
        print(f"  [{status}] {r['name']}")
    print("=" * 60)

    if failures > 0:
        print(f"\n{failures} VERIFICATION FAILURE(S) DETECTED")
        sys.exit(1)
    else:
        print("\nAll verifications passed.")
        sys.exit(0)


if __name__ == "__main__":
    main()
