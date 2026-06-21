# Claude Code 任务单：v2-08 — 后端路由清理 + ug_service JSON-RPC 适配

遵守全部规则文件。

## 问题
1. backend/main.py ROUTES 引用了 ai_service/ocr_service
2. backend/__init__.py 同样导入
3. ug_service.py 是独立脚本，缺少 JSON-RPC execute() 方法
4. 前端 searchService 调用 "ai_search.getModelStatus" 需对齐

## 必须实现
1. 移除 ROUTES 中 ai_search 和 ocr（保留 ai_service.py/ocr_service.py 文件不删）
2. 移除 __init__.py 中对应 import
3. 给 ug_service.py 添加 execute(method, params) 函数支持 JSON-RPC 调用
4. 前端 searchService.getModelStatus 改为调用 "search.modelStatus"
5. backend/main.py 启动时自动检查 Python 依赖
6. `python -c "import py_compile; py_compile.compile('backend/main.py', doraise=True); print('OK')"`
7. `npm run build` 零错误

## 不要修改
- 不删 ai_service.py/ocr_service.py
- shell/theme/i18n

## 不执行 git commit/push
