-- ZOOBET检索 v2 数据库建表语句
-- 3 表: libraries / images / settings

CREATE TABLE IF NOT EXISTS libraries (id INTEGER PRIMARY KEY AUTOINCREMENT, path TEXT NOT NULL UNIQUE, label TEXT, prt_count INTEGER DEFAULT 0, image_count INTEGER DEFAULT 0, last_scan TEXT, status TEXT DEFAULT 'idle', created_at TEXT DEFAULT (datetime('now','localtime')));
CREATE TABLE IF NOT EXISTS images (img_id TEXT PRIMARY KEY, source_type TEXT NOT NULL CHECK(source_type IN ('excel-embedded','ug-preview')), image_path TEXT NOT NULL, origin_path TEXT NOT NULL, sheet_name TEXT, row_number INTEGER, ug_ref TEXT, vector_id INTEGER, file_hash TEXT, indexed_at TEXT DEFAULT (datetime('now','localtime')));
CREATE INDEX IF NOT EXISTS idx_images_ug_ref ON images(ug_ref);
CREATE INDEX IF NOT EXISTS idx_images_origin ON images(origin_path);
CREATE INDEX IF NOT EXISTS idx_images_source ON images(source_type);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
