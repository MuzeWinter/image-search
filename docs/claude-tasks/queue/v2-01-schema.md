# Claude Code 任务单：v2-01 — 数据库 schema 精简 10表→3表

遵守 AGENTS.md + CLAUDE.md + AI-CODING-RULES.md。

## 目标
重写 `backend/db/schema.sql` 为 3 表 (libraries/images/settings)，删除旧数据库。

## 必须实现
1. 重写 schema.sql 只含 3 张表 (libraries/images/settings)
2. 删除 backend/data/zoobet.db
3. 验证：`python -c "import sqlite3; conn=sqlite3.connect(':memory:'); conn.executescript(open('backend/db/schema.sql').read()); print('OK')"`
4. 更新 db_service.py 适配新 schema
5. `npm run build` 通过

## Schema 内容
```sql
CREATE TABLE IF NOT EXISTS libraries (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL UNIQUE, label TEXT, prt_count INTEGER DEFAULT 0, image_count INTEGER DEFAULT 0, last_scan TEXT, status TEXT DEFAULT 'idle', created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS images (img_id TEXT PRIMARY KEY, source_type TEXT NOT NULL CHECK(source_type IN ('excel-embedded','ug-preview')), image_path TEXT NOT NULL, origin_path TEXT NOT NULL, sheet_name TEXT, row_number INTEGER, ug_ref TEXT, vector_id INTEGER, file_hash TEXT, indexed_at TEXT DEFAULT (datetime('now','localtime')));
CREATE INDEX IF NOT EXISTS idx_images_ug_ref ON images(ug_ref);
CREATE INDEX IF NOT EXISTS idx_images_origin ON images(origin_path);
CREATE INDEX IF NOT EXISTS idx_images_source ON images(source_type);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
```

## 不要修改
- Shell 组件、主题/i18n、Tauri 配置

## 不执行 git commit/push
