-- ZOOBET检索 数据库建表语句
-- Phase 2: 服务注册中心 + 数据库

CREATE TABLE IF NOT EXISTS libraries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    path        TEXT NOT NULL UNIQUE,
    label       TEXT,
    file_count  INTEGER DEFAULT 0,
    image_count INTEGER DEFAULT 0,
    last_scan   TEXT,
    status      TEXT DEFAULT 'idle',
    created_at  TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS images (
    img_id       TEXT PRIMARY KEY,
    source_type  TEXT NOT NULL,
    file_path    TEXT NOT NULL,
    folder       TEXT,
    filename     TEXT,
    size_bytes   INTEGER,
    width        INTEGER,
    height       INTEGER,
    file_hash    TEXT,
    vector_id    INTEGER,
    ex_ref       TEXT,
    cad_ref      TEXT,
    pdf_ref      TEXT,
    tags         TEXT,
    notes        TEXT,
    favorite     INTEGER DEFAULT 0,
    status       TEXT DEFAULT 'normal',
    last_modified TEXT,
    indexed_at   TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS excel_records (
    ex_id        TEXT PRIMARY KEY,
    file_path    TEXT NOT NULL,
    folder       TEXT,
    filename     TEXT,
    sheet_name   TEXT,
    row_number   INTEGER,
    column_name  TEXT,
    cell_value   TEXT,
    has_image    INTEGER DEFAULT 0,
    file_hash    TEXT,
    last_modified TEXT,
    indexed_at   TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS cad_files (
    cad_id       TEXT PRIMARY KEY,
    file_path    TEXT NOT NULL,
    folder       TEXT,
    filename     TEXT,
    extension    TEXT,
    size_bytes   INTEGER,
    file_hash    TEXT,
    img_ref      TEXT,
    tags         TEXT,
    notes        TEXT,
    status       TEXT DEFAULT 'normal',
    last_modified TEXT,
    indexed_at   TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS pdf_files (
    doc_id       TEXT PRIMARY KEY,
    file_path    TEXT NOT NULL,
    folder       TEXT,
    filename     TEXT,
    size_bytes   INTEGER,
    page_count   INTEGER,
    file_hash    TEXT,
    preview_path TEXT,
    img_ref      TEXT,
    tags         TEXT,
    notes        TEXT,
    status       TEXT DEFAULT 'normal',
    last_modified TEXT,
    indexed_at   TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS matches (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    img_id       TEXT NOT NULL,
    ex_id        TEXT,
    cad_id       TEXT,
    pdf_id       TEXT,
    status       TEXT DEFAULT 'auto',
    method       TEXT,
    confidence   TEXT,
    created_at   TEXT DEFAULT (datetime('now','localtime')),
    updated_at   TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS scan_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    library_id   INTEGER,
    scan_type    TEXT,
    added        INTEGER DEFAULT 0,
    removed      INTEGER DEFAULT 0,
    modified     INTEGER DEFAULT 0,
    moved        INTEGER DEFAULT 0,
    errors       INTEGER DEFAULT 0,
    duration_sec INTEGER,
    scanned_at   TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS change_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    change_type  TEXT,
    img_id       TEXT,
    ex_id        TEXT,
    cad_id       TEXT,
    doc_id       TEXT,
    old_value    TEXT,
    new_value    TEXT,
    file_path    TEXT,
    status       TEXT DEFAULT 'processed',
    created_at   TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS settings (
    key          TEXT PRIMARY KEY,
    value        TEXT
);

CREATE TABLE IF NOT EXISTS vector_embeddings (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    img_id       TEXT NOT NULL UNIQUE,
    vector_dim   INTEGER NOT NULL,
    vector_blob  BLOB NOT NULL,
    created_at   TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (img_id) REFERENCES images(img_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_vector_embeddings_img_id ON vector_embeddings(img_id);

CREATE TABLE IF NOT EXISTS search_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    query_image  TEXT,
    result_count INTEGER,
    duration_ms  INTEGER,
    searched_at  TEXT DEFAULT (datetime('now','localtime'))
);
