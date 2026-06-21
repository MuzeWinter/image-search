-- ZOOBET检索 v2 数据库建表语句
-- 全表定义，兼容所有服务模块的列名

-- 资料库
CREATE TABLE IF NOT EXISTS libraries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    label TEXT,
    file_count INTEGER DEFAULT 0,
    image_count INTEGER DEFAULT 0,
    last_scan TEXT,
    status TEXT DEFAULT 'idle',
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- 图片索引（兼容 excel_embedded / ug-preview / file_image 三种来源）
CREATE TABLE IF NOT EXISTS images (
    img_id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL CHECK(source_type IN ('excel_embedded','ug-preview','file_image')),
    file_path TEXT NOT NULL,
    image_path TEXT,
    origin_path TEXT,
    folder TEXT,
    filename TEXT,
    size_bytes INTEGER,
    width INTEGER,
    height INTEGER,
    file_hash TEXT,
    ex_ref TEXT,
    ug_ref TEXT,
    cad_ref TEXT,
    pdf_ref TEXT,
    vector_id INTEGER,
    sheet_name TEXT,
    row_number INTEGER,
    tags TEXT DEFAULT '',
    favorite INTEGER DEFAULT 0,
    status TEXT DEFAULT 'normal',
    last_modified TEXT,
    indexed_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_images_ug_ref ON images(ug_ref);
CREATE INDEX IF NOT EXISTS idx_images_origin ON images(origin_path);
CREATE INDEX IF NOT EXISTS idx_images_source ON images(source_type);
CREATE INDEX IF NOT EXISTS idx_images_file_path ON images(file_path);
CREATE INDEX IF NOT EXISTS idx_images_ex_ref ON images(ex_ref);

-- 键值设置
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- CLIP 向量存储
CREATE TABLE IF NOT EXISTS vector_embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    img_id TEXT NOT NULL UNIQUE,
    vector_dim INTEGER NOT NULL,
    vector_blob BLOB NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (img_id) REFERENCES images(img_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_vector_embeddings_img_id ON vector_embeddings(img_id);

-- Excel 单元格记录
CREATE TABLE IF NOT EXISTS excel_records (
    ex_id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    folder TEXT,
    filename TEXT,
    sheet_name TEXT,
    row_number INTEGER,
    column_name TEXT,
    cell_value TEXT,
    has_image INTEGER DEFAULT 0,
    file_hash TEXT,
    last_modified TEXT,
    indexed_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_excel_records_file_path ON excel_records(file_path);

-- CAD 文件
CREATE TABLE IF NOT EXISTS cad_files (
    cad_id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    folder TEXT,
    filename TEXT,
    extension TEXT,
    size_bytes INTEGER,
    file_hash TEXT,
    status TEXT DEFAULT 'normal',
    last_modified TEXT,
    indexed_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_cad_files_file_path ON cad_files(file_path);

-- PDF 文件
CREATE TABLE IF NOT EXISTS pdf_files (
    doc_id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    folder TEXT,
    filename TEXT,
    size_bytes INTEGER,
    page_count INTEGER DEFAULT 0,
    file_hash TEXT,
    status TEXT DEFAULT 'normal',
    last_modified TEXT,
    indexed_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_pdf_files_file_path ON pdf_files(file_path);

-- 搜索历史
CREATE TABLE IF NOT EXISTS search_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query_image TEXT,
    result_count INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- 关联匹配
CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    img_id TEXT,
    cad_id TEXT,
    ex_id TEXT,
    pdf_id TEXT,
    status TEXT DEFAULT 'auto',
    method TEXT,
    confidence TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (img_id) REFERENCES images(img_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_matches_img_id ON matches(img_id);
CREATE INDEX IF NOT EXISTS idx_matches_cad_id ON matches(cad_id);

-- 变更日志（扫描差异）
CREATE TABLE IF NOT EXISTS change_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    change_type TEXT NOT NULL,
    file_path TEXT,
    old_value TEXT,
    new_value TEXT,
    status TEXT DEFAULT 'processed',
    created_at TEXT DEFAULT (datetime('now','localtime'))
);

-- 活动日志
CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT NOT NULL CHECK(level IN ('info', 'warn', 'error')),
    source TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_activity_logs_level ON activity_logs(level);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

-- 扫描历史
CREATE TABLE IF NOT EXISTS scan_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    library_id INTEGER,
    scan_type TEXT DEFAULT 'full',
    added INTEGER DEFAULT 0,
    removed INTEGER DEFAULT 0,
    modified INTEGER DEFAULT 0,
    moved INTEGER DEFAULT 0,
    errors INTEGER DEFAULT 0,
    duration_sec REAL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
);
