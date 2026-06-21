# Claude Code 任务单：v2-10 — 端到端集成验证 + Python 依赖检查

遵守全部规则文件。

## 目标
验证所有模块可以串联工作。

## 必须实现
1. `python backend/main.py` 可启动不报错（导入检查）
2. 后端 JSON-RPC 测试：echo '{"jsonrpc":"2.0","id":1,"method":"db.init","params":{}}' | python backend/main.py
3. 确认 schema.sql 建表成功
4. 确认 search_service 的 CLIP/FAISS import 不会崩溃
5. 如果有缺失的 Python 依赖，在 requirements 中声明
6. 更新或创建 `backend/requirements.txt`
7. `npm run build` 零错误
8. `cargo build` 零错误

## 不执行 git commit/push
