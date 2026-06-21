"""ZOOBET检索 Python 后端 JSON-RPC 入口

通过 stdin 逐行读取 JSON 请求，路由到服务模块，返回 JSON 响应到 stdout。
所有输出写 stderr 用于日志，stdout 仅用于 JSON-RPC 响应。
"""

import sys
import os
import json
import traceback

# Add project root to Python path so `backend` package is importable
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from backend.services import db_service, settings_service, library_service, excel_service, ai_service, search_service, ocr_service, ug_service

ROUTES = {
    "db": db_service,
    "settings": settings_service,
    "library": library_service,
    "excel": excel_service,
    "ai_search": ai_service,
    "search": search_service,
    "ocr": ocr_service,
    "ug": ug_service,
}


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


def handle_request(req: dict):
    method = req.get("method", "")
    params = req.get("params", {})
    req_id = req.get("id", 0)

    parts = method.split(".", 1)
    if len(parts) < 2:
        send_error(req_id, -32601, f"Invalid method format: {method}")
        return

    service_name = parts[0]
    service = ROUTES.get(service_name)
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

    # 初始化数据库
    try:
        db_service.execute("db.init", {})
        log("Database initialized")
    except Exception as e:
        log(f"Database init failed: {e}")

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
