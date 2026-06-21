# Claude Code 任务单：v2-31 — 数据库维护 (VACUUM/优化)

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
设置页增加数据库优化按钮，执行 SQLite VACUUM 和索引重建。

## 必须实现

### 1. 后端 (db_service.py)
- 新增 `db.vacuum` 方法
- 新增 `db.stats` 方法（数据库文件大小、表行数）
- 新增 `db.optimize` 方法（重建索引 + VACUUM）

### 2. 前端 (Settings.tsx)
- 在"数据维护"区域显示数据库大小
- 添加"优化数据库"按钮
- 优化完成后显示释放空间大小

### 3. 验收标准
- `npm run build` 零错误
- 数据库文件大小正确显示
- VACUUM 不损坏数据

## 不执行 git commit/push
