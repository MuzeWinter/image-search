# Claude Code 任务单：v2-85 — Python后端测试覆盖

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
为关键后端服务创建 pytest 单元测试。

## 必须实现
- `backend/tests/` 目录
- `test_db_service.py` — 数据库初始化、查询
- `test_search_service.py` — 向量索引、搜索
- `test_library_service.py` — 资料库 CRUD
- 使用内存 SQLite 隔离测试

## 验收标准
- `python -m pytest backend/tests/ -v` 全部通过

## 不执行 git commit/push
