# ZOOBET检索 v2 — 设计规格文档

> 日期: 2026-06-21  
> 状态: 已批准  
> 上一版: v1 全功能版（12页/10表/10服务）→ 本版精简聚焦版

---

## 1. 产品定义

### 一句话描述

Windows 本地桌面工具：拖入参考图 → CLIP 搜索→ 返回 UG 图纸编号/路径 → 打开所在文件夹。

### 用户场景

设计师面对 10 年积累的 UG 图纸和 Excel 账单。核心痛点：

1. **Excel 里的图** — 账单表格贴了产品图，旁边列写了 UG 图号，但人工翻表找太慢
2. **独立的 UG 文件** — 大量 .prt 没做到表格里，只有文件系统里的文件名/文件夹结构
3. **客户发的参考图** — 不知道编号，不知道在哪个 Excel 哪个文件夹

软件要做的是：不管图片源头是 Excel 内嵌图还是 UG 预览图，全部放进一个索引。用户拖入任意参考图 → 一次性搜到所有匹配。

```
客户参考图
  → CLIP 向量搜索
    → 命中 Excel 内嵌图 → 返回 UG 编号 (ug_ref 列)
    → 命中 UG 预览图 → 返回 .prt 文件路径
  → 结果：IMG 编号 / UG 路径 / 来源 / 相似度
  → 点击 → 打开文件所在文件夹
```

### 不做什么

- 不解析 UG 3D 模型内容，只提取预览图
- 不做 CAD/PDF/PSD 等
- 不做标签、收藏、匹配管理
- 不做 OCR

---

## 2. 技术架构

### 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 桌面壳 | Tauri v2 | 无标题栏窗口 |
| 前端 | React 18 + TypeScript + Vite | 3 页面 |
| 状态 | Jotai | 原子化 |
| 后端 | Python 3.11+ (sidecar) | JSON-RPC over stdin/stdout |
| 图像模型 | OpenCLIP ViT-B/32 | 512 维向量 |
| 向量检索 | FAISS | top-K 搜索 |
| UG 预览提取 | NXOpen Python API | 批量提取 .prt 内嵌预览图 |
| 数据库 | SQLite (WAL) | 3 表 |

### NXOpen 集成

```
用户电脑装了 Siemens NX
  → Python 脚本调用 NXOpen
    → 批量打开 .prt (无 UI 模式)
    → 导出 JT preview → 转 PNG
    → 和 Excel 内嵌图一起加入 CLIP+FAISS 索引
```

首次全量扫描最慢（10 年文件），后续增量只处理新增/修改的 .prt。

---

## 3. 数据设计

### 3.1 数据库表

```sql
CREATE TABLE libraries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    path          TEXT NOT NULL UNIQUE,
    label         TEXT,
    prt_count     INTEGER DEFAULT 0,
    image_count   INTEGER DEFAULT 0,
    last_scan     TEXT,
    status        TEXT DEFAULT 'idle',
    created_at    TEXT DEFAULT (datetime('now','localtime'))
);

-- 统一图片索引 (Excel内嵌图 + UG预览图)
CREATE TABLE images (
    img_id        TEXT PRIMARY KEY,           -- IMG-000001
    source_type   TEXT NOT NULL,              -- 'excel-embedded' | 'ug-preview'
    image_path    TEXT NOT NULL,              -- 提取出的图片路径
    origin_path   TEXT NOT NULL,              -- Excel路径 或 UG .prt路径
    sheet_name    TEXT,                       -- Excel: 工作表名
    row_number    INTEGER,                    -- Excel: 行号
    ug_ref        TEXT,                       -- 对应 UG 编号/图号
    vector_id     INTEGER,                    -- FAISS 索引位置
    file_hash     TEXT,                       -- SHA256
    indexed_at    TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX idx_images_ug_ref ON images(ug_ref);
CREATE INDEX idx_images_origin ON images(origin_path);
CREATE INDEX idx_images_source ON images(source_type);

CREATE TABLE settings (
    key           TEXT PRIMARY KEY,
    value         TEXT
);
```

### 3.2 关键字段说明

| 字段 | Excel 内嵌图 | UG 预览图 |
|------|-------------|----------|
| source_type | `excel-embedded` | `ug-preview` |
| origin_path | Excel 文件路径 | .prt 文件路径 |
| sheet_name | 工作表名 | NULL |
| row_number | 行号 | NULL |
| ug_ref | 同行"编号列"的值 | .prt 文件名（不含扩展名） |

---

## 4. 模块设计

### 4.1 前端（3 页面 + Shell）

```
Shell (主 bundle, <100ms 渲染):
  Sidebar:  搜索首页 / 资料库管理 / 设置
  Header:   窗口拖拽 + 窗口控制 + 主题/语言切换
  StatusBar: 资料库 X 个 · 已索引 X 张

Pages (React.lazy + Suspense):
  Search.tsx       /            拖图搜 + 结果列表
  Libraries.tsx    /libraries   文件夹设置 + 扫描 + 进度
  Settings.tsx     /settings    主题/语言/编号列名/UG预览开关
```

### 4.2 前端服务层

```
src/services/
  ipc.ts              # 统一 invoke 封装
  scanService.ts      # 扫描+进度事件
  searchService.ts    # 搜索+模型状态
  libraryService.ts   # 资料库 CRUD
  settingsService.ts  # 设置
```

### 4.3 Python 后端（5 个服务）

```
backend/main.py              # JSON-RPC 入口
backend/db/connection.py     # SQLite (WAL)
backend/db/schema.sql        # 建表
backend/services/
  db_service.py              # 数据库初始化
  scan_service.py            # 遍历文件夹 → 找到 .xlsx/.xls/.prt
  excel_service.py           # 解析 Excel → 提取内嵌图 → 读 ug_ref
  ug_service.py              # NXOpen 批量提取 .prt 预览图
  search_service.py          # CLIP 特征提取 + FAISS 搜索
  model_service.py           # CLIP 模型加载
```

---

## 5. 核心流程

### 5.1 扫描流程

```
用户设置资料库路径 → 点击扫描
  阶段1: 收集文件
    遍历目录树 → 列出所有 .xlsx/.xls/.prt
  阶段2: 处理 Excel
    excel_service:
      openpyxl 打开 → 提取内嵌图片 → 读同行编号列(ug_ref)
      → 写入 images 表 (source_type=excel-embedded)
  阶段3: 处理 UG 文件  [可选,设置中开关]
    ug_service:
      NXOpen 批量模式 → 打开 .prt → 导出预览图
      → 写入 images 表 (source_type=ug-preview, ug_ref=文件名)
  阶段4: 建立索引
    search_service:
      CLIP 提取所有新增图片的 512 维向量
      FAISS 索引更新
```

### 5.2 搜索流程

```
用户拖入图片
  ├─ CLIP 提取查询图向量
  ├─ FAISS 搜索 top-5
  ├─ vector_id → images 表反查
  └─ 返回结果
      ├─ IMG 编号 + 相似度
      ├─ 来源类型 (Excel内嵌 / UG预览)
      ├─ 来源路径 (Excel文件 / .prt文件)
      ├─ UG 编号 (ug_ref)
      └─ 操作: 打开 Excel / 打开 UG 文件夹
```

---

## 6. IPC 接口

```
// 资料库
library.list          → Library[]
library.add           → Library     (params: path, label)
library.remove        → void        (params: id)
library.scan          → {taskId}    (params: id)

// 搜索
search.byImage        → SearchResult[]  (params: imagePath, topK=5)
search.modelStatus    → {loaded, progress}
search.imageList      → {images, total} (params: page, pageSize)

// 设置
settings.get          → string|null    (params: key)
settings.set          → void           (params: key, value)

// 系统
system.openFolder     → void     (params: path)
system.openFile       → void     (params: path)

// 事件 (后端→前端)
scan:progress     → {phase, current, total, currentFile, percent}
model:loading     → {progress: 0.0..1.0}
```

---

## 7. 界面

### 7.1 窗口
- 无标题栏 (decorations: false)
- 1280×800, min 900×600
- 深色/浅色主题
- 中/英文切换

### 7.2 搜索页

```
┌──────────────────────────────────────────────┐
│                                              │
│     ┌────────────────────────────┐           │
│     │   拖入图片 或 Ctrl+V 粘贴    │           │
│     └────────────────────────────┘           │
│                                              │
│  搜索结果 (top-5)                             │
│  ┌────────────────────────────────────────┐  │
│  │ #1 [缩略图] IMG-0042  相似度 97%        │  │
│  │     Excel: 产品清单.xlsx · Sheet1 R342  │  │
│  │     UG: TIGER-CLAMP-V3                 │  │
│  │     [打开 Excel] [打开 UG 文件夹]        │  │
│  ├────────────────────────────────────────┤  │
│  │ #2 [缩略图] IMG-0821  相似度 85%        │  │
│  │     UG 文件: cover_bottom_v2.prt       │  │
│  │     [打开 UG 文件夹]                    │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

### 7.3 资料库页

```
┌──────────────────────────────────────────────┐
│  资料库管理                                    │
│                                              │
│  文件夹: [D:\10年图纸______________] [浏览]   │
│                                              │
│  状态: ● 就绪   已索引: 12,847 张             │
│  上次扫描: 2026-06-21 14:32 (耗时 4m12s)      │
│  UG 预览提取: ☑ 启用                          │
│                                              │
│  [开始扫描]                                   │
│                                              │
│  进度: ████████░░░░░░░░ 52%                   │
│  阶段: 处理 UG 文件 · housing_v3.prt          │
└──────────────────────────────────────────────┘
```

### 7.4 设置页

```
┌──────────────────────────────────────────────┐
│  设置                                         │
│                                              │
│  外观                                        │
│  主题:    [浅色] [深色] [跟随系统]             │
│  语言:    [中文] [English]                    │
│                                              │
│  扫描                                        │
│  编号列名: [图号________]  (Excel 中 UG 编号列) │
│  UG预览:  [☑] 启用 NXOpen 提取               │
│                                              │
│  关于                                        │
│  ZOOBET检索 v2.0 · 本地运行                  │
└──────────────────────────────────────────────┘
```

---

## 8. 与现有代码的关系

现有项目有 138 个文件。v2 需要：

| 操作 | 涉及文件 |
|------|----------|
| 保留 | Tauri 配置、Shell 组件(5)、主题/i18n、IPC 层、Python 框架、CLIP/FAISS 服务 |
| 删除 | CAD/PDF/Tags/Favorites/Match/Changelog 页面、对应后端服务、对应 i18n key |
| 新增 | ug_service.py (NXOpen)、简化版 Search/Libraries/Settings 页面 |
| 修改 | types.ts、schema.sql、scan_service.py |

---

## 9. 自审

- 无占位符/TODO ✅
- 3 表 vs 10 表，5 服务 vs 10 服务 ✅
- UX 聚焦：拖图→搜索结果→打开文件夹，三步完成 ✅
- UG 文件全覆盖：Excel 内嵌图 + NXOpen 预览图 ✅
