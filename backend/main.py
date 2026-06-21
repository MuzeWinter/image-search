"""ZOOBET检索 Python 后端 JSON-RPC 入口

通过 stdin 逐行读取 JSON 请求，路由到服务模块，返回 JSON 响应到 stdout。
所有输出写 stderr 用于日志，stdout 仅用于 JSON-RPC 响应。

Services are loaded lazily on first request — only db_service is loaded at startup.
"""

import sys
import os
import json
import traceback
import importlib

# Add project root to Python path so `backend` package is importable
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

# Lazy service registry: route name → module path
_SERVICE_MODULE_MAP: dict[str, str] = {
    "db": "backend.services.db_service",
    "settings": "backend.services.settings_service",
    "library": "backend.services.library_service",
    "excel": "backend.services.excel_service",
    "search": "backend.services.search_service",
    "ug": "backend.services.ug_service",
    "scan": "backend.services.scan_service",
    "system": "backend.services.system_service",
    "errorReport": "backend.services.error_report_service",
    "ocr": "backend.services.ocr_service",
}

_services: dict[str, object] = {}


def log(msg: str):
    print(f"[backend] {msg}", file=sys.stderr, flush=True)


def send_response(req_id, result):
    resp = {"jsonrpc": "2.0", "id": req_id, "result": result}
    sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def send_error(req_id, code, message):
    resp = {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}
    sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _get_service(service_name: str):
    """Lazily import and cache a service module by its route name."""
    if service_name in _services:
        return _services[service_name]

    module_path = _SERVICE_MODULE_MAP.get(service_name)
    if module_path is None:
        return None

    try:
        module = importlib.import_module(module_path)
    except ImportError as e:
        log(f"Failed to import {module_path}: {e}")
        return None

    _services[service_name] = module
    return module


def handle_request(req: dict):
    method = req.get("method", "")
    params = req.get("params", {})
    req_id = req.get("id", 0)

    parts = method.split(".", 1)
    if len(parts) < 2:
        send_error(req_id, -32601, f"Invalid method format: {method}")
        return

    service_name = parts[0]
    service = _get_service(service_name)
    if service is None:
        send_error(req_id, -32601, f"Service not found: {service_name}")
        return

    try:
        result = service.execute(method, params)
        send_response(req_id, result)
    except Exception as e:
        tb = traceback.format_exc()
        log(f"Error handling {method}: {e}\n{tb}")
        send_error(req_id, -32000, str(e))


def main():
    log("Python backend started, waiting for requests on stdin...")

    # Eagerly load db_service and init database (required for everything else)
    try:
        db_service = _get_service("db")
        if db_service is not None:
            db_service.execute("db.init", {})
            log("Database initialized")
    except Exception as e:
        log(f"Database init failed: {e}")
        # Database corruption detected — try to generate error report
        try:
            error_report = _get_service("errorReport")
            if error_report is not None:
                report = error_report.generate_report(
                    trigger="db-corruption",
                    context=f"Database init failed at startup: {e}",
                    db_available=False,
                )
                log(f"Error report generated: {report.get('path', 'unknown')}")
        except Exception as re:
            log(f"Failed to generate error report: {re}")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            handle_request(req)
        except json.JSONDecodeError as e:
            log(f"Invalid JSON input: {e}")
            sys.stdout.write(
                json.dumps(
                    {
                        "jsonrpc": "2.0",
                        "id": None,
                        "error": {"code": -32700, "message": f"Parse error: {e}"},
                    },
                    ensure_ascii=False,
                )
                + "\n"
            )
            sys.stdout.flush()


if __name__ == "__main__":
    main()
