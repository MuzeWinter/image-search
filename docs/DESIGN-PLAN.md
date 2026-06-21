# ZOOBET检索 — 设计资料图片搜索助手 设计规划文档

> 版本: v1.0  
> 日期: 2026-06-21  
> 状态: 原型阶段 → 正式开发规划  

---

## 一、项目概述

### 1.1 产品定位

**ZOOBET检索** 是一款 Windows 桌面端本地 AI 视觉搜索引擎，专为产品设计师打造。

核心场景：设计师收到客户发来的一张参考图片后，将图片拖入软件，软件通过 AI 视觉模型在本机历史资料库中搜索相似图片，并自动关联其来源（Excel 记录、UG/CAD 文件路径、PDF 文档、原始图片路径、编号和备注）。

### 1.2 核心价值

| 痛点 | 解决方案 |
|------|----------|
| 设计资料分散在多个文件夹 | 统一扫描、索引、管理 |
| Excel 里贴的图找不到来源 | 提取 Excel 内嵌图片并建立索引 |
| 客户图相似但记不清编号 | 本地 AI 以图搜图，秒级返回 |
| UG/CAD 文件与图片对不上 | 智能关联 + 人工确认匹配关系 |
| 数据上传云端有安全风险 | 全程本地运行，零数据外传 |

### 1.3 关键约束

- 所有数据本地处理，不上传云端
- 用户安装后直接可用，不需手动装 Python/AI 模型
- 离线可用
- 支持中文路径、空格路径
- Windows 10/11，高分屏适配

---

## 二、当前原型分析

### 2.1 原型文件清单

| 文件 | 页面 | 状态 |
|------|------|------|
| `index.html` | 功能导航首页 | 原型完成 |
| `01-search.html` | 以图搜图主页 | 原型完成 |
| `02-image-library.html` | 图片库浏览 | 原型完成 |
| `03-library.html` | 资料库管理 | 原型完成 |
| `04-scan-report.html` | 扫描报告 | 原型完成 |
| `05-match-management.html` | 匹配关系管理 | 原型完成 |
| `06-cad-files.html` | CAD/UG 文件 | 原型完成 |
| `07-excel-records.html` | Excel 记录 | 原型完成 |
| `08-pdf-files.html` | PDF 文件 | 原型完成 |
| `09-tags.html` | 标签分类 | 原型完成 |
| `10-favorites.html` | 收藏夹 | 原型完成 |
| `11-settings.html` | 设置页 | 原型完成 |
| `12-changelog.html` | 变更记录 | 原型完成 |
| `css/design-system.css` | 设计系统 | 完成 |
| `js/app.js` | Mock 数据 | 仅演示数据 |

### 2.2 原型技术栈

- 纯静态 HTML + CSS + JavaScript
- 无框架、无构建工具
- 使用 CSS 自定义属性做主题变量
- Mock 数据硬编码在 JS 中

### 2.3 原型迁移策略

原型中的 12 个页面布局、侧边栏导航、设计系统（CSS 变量）全部保留，作为正式开发的 UI 参考。Mock 数据将在正式开发中替换为真实后端接口。

---

## 三、目标技术架构

### 3.1 架构总览

```
┌─────────────────────────────────────────────┐
│                  Desktop UI                  │
│        Tauri + React + TypeScript           │
├─────────────────────────────────────────────┤
│              Tauri IPC Bridge               │
├─────────────────────────────────────────────┤
│              Python Backend                 │
│  ┌──────────┬──────────┬──────────────┐    │
│  │ OpenCLIP │  FAISS   │  PaddleOCR   │    │
│  │ 特征提取  │ 向量检索  │  文字识别     │    │
│  └──────────┴──────────┴──────────────┘    │
│  ┌────────────────────────────────────┐    │
│  │         SQLite 本地数据库           │    │
│  └────────────────────────────────────┘    │
│  ┌────────────────────────────────────┐    │
│  │     File Scanner & Indexer         │    │
│  └────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 3.2 技术选型

| 层 | 技术 | 原因 |
|----|------|------|
| 桌面框架 | **Tauri v2** | 体积小、Rust 内核、Windows 原生支持好 |
| 前端 | **React 18 + TypeScript** | 生态成熟、类型安全 |
| 前端构建 | **Vite** | 快速开发 |
| 后端 | **Python 3.11+** (嵌入) | OpenCLIP/FAISS/PaddleOCR 生态 |
| 图搜模型 | **OpenCLIP** (ViT-B/32) | 开源、本地运行、中文支持 |
| 向量检索 | **FAISS** | Meta 出品、十亿级向量毫秒检索 |
| OCR | **PaddleOCR** | 中文识别最优、本地运行 |
| 数据库 | **SQLite** | 零配置、单文件、够用 |
| 打包 | **Tauri bundler** | 打包为 .msi / .exe |

### 3.3 Python 嵌入方案

Python 后端通过 Tauri Sidecar 或嵌入 Python 运行时方式运行：
- 方案 A（推荐）: PyInstaller 打包为独立 exe，Tauri 通过 sidecar 启动
- 方案 B: 嵌入 python311.dll + 依赖，通过 Rust `PyO3` 调用

推荐方案 A，隔离性好，调试方便。

---

## 四、数据库设计

### 4.1 SQLite 表结构

```sql
-- 资料库（用户设置的扫描目标文件夹）
CREATE TABLE libraries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    path        TEXT NOT NULL UNIQUE,
    label       TEXT,
    file_count  INTEGER DEFAULT 0,
    last_scan   TEXT,
    status      TEXT DEFAULT 'idle',  -- idle/scanning/ready/error
    created_at  TEXT DEFAULT (datetime('now','localtime'))
);

-- 图片索引
CREATE TABLE images (
    img_id       TEXT PRIMARY KEY,          -- IMG-000001
    source_type  TEXT NOT NULL,             -- excel-embedded/standalone/pdf-preview/screenshot
    file_path    TEXT NOT NULL,             -- 图片实际文件路径
    folder       TEXT,
    filename     TEXT,
    size_bytes   INTEGER,
    width        INTEGER,
    height       INTEGER,
    file_hash    TEXT,                      -- SHA256
    vector_id    INTEGER,                   -- FAISS 索引 ID
    ex_ref       TEXT,                      -- 关联 Excel 记录 EX-000001
    cad_ref      TEXT,                      -- 关联 CAD 编号
    pdf_ref      TEXT,                      -- 关联 PDF 编号
    tags         TEXT,                      -- JSON array
    notes        TEXT,
    favorite     INTEGER DEFAULT 0,
    status       TEXT DEFAULT 'normal',
    last_modified TEXT,
    indexed_at   TEXT DEFAULT (datetime('now','localtime'))
);

-- Excel 记录
CREATE TABLE excel_records (
    ex_id        TEXT PRIMARY KEY,          -- EX-000001
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

-- CAD/UG 文件
CREATE TABLE cad_files (
    cad_id       TEXT PRIMARY KEY,          -- CAD-000001
    file_path    TEXT NOT NULL,
    folder       TEXT,
    filename     TEXT,
    extension    TEXT,                      -- prt/step/igs/dwg/...
    size_bytes   INTEGER,
    file_hash    TEXT,
    img_ref      TEXT,                      -- 关联预览图 IMG-xxxxxx
    tags         TEXT,
    notes        TEXT,
    status       TEXT DEFAULT 'normal',
    last_modified TEXT,
    indexed_at   TEXT DEFAULT (datetime('now','localtime'))
);

-- PDF 文件
CREATE TABLE pdf_files (
    doc_id       TEXT PRIMARY KEY,          -- DOC-000001
    file_path    TEXT NOT NULL,
    folder       TEXT,
    filename     TEXT,
    size_bytes   INTEGER,
    page_count   INTEGER,
    file_hash    TEXT,
    preview_path TEXT,                      -- 首页预览图路径
    img_ref      TEXT,
    tags         TEXT,
    notes        TEXT,
    status       TEXT DEFAULT 'normal',
    last_modified TEXT,
    indexed_at   TEXT DEFAULT (datetime('now','localtime'))
);

-- 匹配关系
CREATE TABLE matches (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    img_id       TEXT NOT NULL,
    ex_id        TEXT,
    cad_id       TEXT,
    pdf_id       TEXT,
    status       TEXT DEFAULT 'auto',       -- auto/suspected/confirmed/manual/unmatched
    method       TEXT,                      -- excel-reference/filename-match/same-folder/ai-similar/manual-bind
    confidence   TEXT,                      -- high/medium/low
    created_at   TEXT DEFAULT (datetime('now','localtime')),
    updated_at   TEXT DEFAULT (datetime('now','localtime'))
);

-- 扫描历史
CREATE TABLE scan_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    library_id   INTEGER,
    scan_type    TEXT,                      -- full/incremental
    added        INTEGER DEFAULT 0,
    removed      INTEGER DEFAULT 0,
    modified     INTEGER DEFAULT 0,
    moved        INTEGER DEFAULT 0,
    errors       INTEGER DEFAULT 0,
    duration_sec INTEGER,
    scanned_at   TEXT DEFAULT (datetime('now','localtime'))
);

-- 变更日志
CREATE TABLE change_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    change_type  TEXT,                      -- image-added/cad-renamed/excel-modified/...
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

-- 设置
CREATE TABLE settings (
    key          TEXT PRIMARY KEY,
    value        TEXT
);

-- 搜索历史
CREATE TABLE search_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    query_image  TEXT,                      -- 查询图片路径
    result_count INTEGER,
    duration_ms  INTEGER,
    searched_at  TEXT DEFAULT (datetime('now','localtime'))
);
```

---

## 五、模块设计

### 5.1 前端模块

| 模块 | 对应页面 | 功能 |
|------|----------|------|
| 导航框架 | 所有页面共享 | 侧边栏 + 顶部栏 + 主题/语言切换 |
| 首页搜索 | `01-search.html` | 拖拽/粘贴/截图搜索、结果显示 |
| 图片库 | `02-image-library.html` | 浏览、筛选、排序、批量操作 |
| 资料库管理 | `03-library.html` | 添加/删除资料库、手动/自动扫描 |
| 扫描报告 | `04-scan-report.html` | 扫描历史、新增/修改/删除/移动统计 |
| 匹配管理 | `05-match-management.html` | 查看/确认/修改/解除匹配关系 |
| CAD 文件 | `06-cad-files.html` | 浏览、筛选、打开文件/文件夹 |
| Excel 记录 | `07-excel-records.html` | 浏览、搜索、打开 Excel |
| PDF 文件 | `08-pdf-files.html` | 浏览、预览、打开 |
| 标签分类 | `09-tags.html` | 标签管理、按标签筛选 |
| 收藏夹 | `10-favorites.html` | 收藏管理 |
| 设置 | `11-settings.html` | 全部设置项 |
| 变更记录 | `12-changelog.html` | 文件变更追踪 |

### 5.2 后端模块

| 模块 | 功能 |
|------|------|
| **scanner** | 递归扫描文件夹、文件发现、类型识别 |
| **excel_parser** | 解析 Excel、提取内嵌图片、生成 IMG 编号 |
| **image_indexer** | OpenCLIP 特征提取、FAISS 索引写入 |
| **cad_indexer** | CAD 文件发现、缩略图生成（可选）、编号生成 |
| **pdf_indexer** | PDF 发现、首页预览图生成、编号生成 |
| **search_engine** | 查询图特征提取 → FAISS 搜索 → 结果组装 |
| **match_engine** | 自动关联（同目录/同文件名/Excel引用） |
| **change_detector** | 文件变更检测（新增/修改/删除/移动/改名） |
| **db_manager** | SQLite CRUD、备份/恢复、索引重建 |
| **ocr_engine** | PaddleOCR 文字识别（可选开启） |
| **settings_manager** | 配置读写 |

---

## 六、IPC 接口设计（前端 ↔ 后端）

### 6.1 资料库管理

```
invoke("add_library", { path: string, label?: string }) → { id, path, status }
invoke("remove_library", { id: number }) → { success: boolean }
invoke("list_libraries") → Library[]
invoke("scan_library", { id: number, type: "full"|"incremental" }) → ScanProgress
invoke("stop_scan") → void
invoke("get_scan_progress") → ScanProgress
```

### 6.2 图片管理

```
invoke("list_images", { page, pageSize, filters? }) → { images: Image[], total }
invoke("get_image", { imgId: string }) → ImageDetail
invoke("update_image", { imgId, tags?, notes?, favorite? }) → Image
invoke("delete_image", { imgId: string }) → void
invoke("batch_delete_images", { imgIds: string[] }) → void
```

### 6.3 搜索

```
invoke("search_by_image", { imagePath: string, topK?: number }) → SearchResult[]
invoke("search_by_text", { query: string, topK?: number }) → SearchResult[]
invoke("search_history") → SearchHistory[]
```

### 6.4 匹配管理

```
invoke("list_matches", { filters? }) → Match[]
invoke("confirm_match", { matchId: number }) → Match
invoke("reject_match", { matchId: number }) → Match
invoke("create_match", { imgId, exId?, cadId?, pdfId? }) → Match
invoke("remove_match", { matchId: number }) → void
```

### 6.5 设置

```
invoke("get_settings") → Settings
invoke("update_setting", { key, value }) → void
invoke("export_data", { targetPath: string }) → void
invoke("import_data", { sourcePath: string }) → void
invoke("rebuild_index") → void
invoke("clear_cache") → void
```

### 6.6 系统

```
invoke("open_file", { path: string }) → void
invoke("open_folder", { path: string }) → void
invoke("copy_path", { path: string }) → void
invoke("get_system_info") → { python_ok, openclip_ok, faiss_ok, gpu_available }
```

---

## 七、UI/UX 设计规范

### 7.1 窗口设计

- 无标题栏一体化设计
- 自定义顶部栏（可拖拽区域 + 窗口控制按钮）
- 左侧导航栏（260px 固定宽度）
- 内容区自适应
- 最小窗口 1024×680
- 圆角 2-6px（偏方正的专业风格）

### 7.2 主题系统

基于现有 `design-system.css` 扩展：

```css
:root {
  --bg-primary
  --bg-secondary
  --surface / --surface-hover / --surface-active / --surface-raised
  --fg (主文字)
  --muted (次要文字)
  --border / --border-heavy
  --accent
  --success / --warning / --danger / --info
}
```

支持:
- 浅色主题（默认，当前设计系统）
- 深色主题
- 跟随系统

### 7.3 字号系统

```css
--text-xs:   0.75rem   /* 辅助信息 */
--text-sm:   0.875rem  /* 次要文字 */
--text-base: 1rem      /* 正文 */
--text-md:   1.125rem  /* 卡片标题 */
--text-lg:   1.375rem  /* 页面标题 */
--text-xl:   1.75rem   /* 大标题 */
--text-2xl:  2.25rem   /* Banner */
--text-3xl:  3rem      /* 超大标题 */
```

### 7.4 字体

- 标题: `Iowan Old Style / Charter / Georgia` (衬线)
- 正文: `-apple-system / Segoe UI / system-ui` (无衬线)
- 代码/编号: `JetBrains Mono / Menlo` (等宽)

### 7.5 状态指示

- `ready` → 绿色圆点
- `scanning` → 蓝色旋转动画
- `error` → 红色圆点
- `idle` → 灰色圆点

---

## 八、实施路线图

### Phase 1: 项目脚手架 (1 周)

- Tauri v2 + React + TypeScript 项目初始化
- Vite 构建配置
- 将现有 CSS 设计系统迁移到 React 组件
- 侧边栏 + 顶部栏框架
- 主题切换基础架构
- i18n 基础架构（中/英）
- Python sidecar 通信验证

### Phase 2: 后端核心 (2 周)

- SQLite 数据库初始化
- 资料库管理 CRUD
- 文件扫描器（递归、类型识别、去重）
- Excel 解析 + 内嵌图片提取
- 编号生成器（IMG/EX/CAD/DOC）
- CAD/PDF 文件索引
- 变更检测引擎

### Phase 3: AI 搜索核心 (2 周)

- OpenCLIP 模型加载与特征提取
- FAISS 索引构建与更新
- 以图搜图接口
- OCR 模块（可选）
- GPU/CPU 自适应

### Phase 4: 前端页面实现 (3 周)

- 首页搜索页面（拖拽/粘贴/截图/结果展示）
- 图片库（浏览/筛选/收藏）
- 资料库管理（添加/删除/扫描/进度）
- CAD 文件 / Excel 记录 / PDF 文件列表
- 匹配管理页面
- 扫描报告页面
- 标签分类 / 收藏夹
- 设置页面（全部设置项闭环）
- 变更记录页面

### Phase 5: 匹配与关联 (1 周)

- 自动匹配引擎（同目录/同文件名/Excel引用）
- 人工确认/修改/解除匹配
- 匹配状态持久化

### Phase 6: 完善与打磨 (1 周)

- 中英文完整翻译
- 深色主题完整适配
- 无标题栏窗口控制
- 首次启动引导
- 错误处理完善
- 大文件扫描进度优化

### Phase 7: 打包与测试 (1 周)

- Windows .msi / .exe 打包
- Python 运行时嵌入
- 模型文件内置
- 中文路径/空格路径测试
- 离线运行测试
- 功能验收测试

---

## 九、关键风险与对策

| 风险 | 等级 | 对策 |
|------|------|------|
| Python sidecar 打包体积大 | 中 | 使用嵌入式 Python 裁剪版，模型量化 |
| OpenCLIP 首次加载慢 | 中 | 启动时预加载、显示加载进度 |
| 大量文件扫描卡 UI | 高 | 后端异步扫描、前端轮询进度、支持中断 |
| FAISS 索引内存占用 | 中 | 分批索引、支持磁盘索引模式 |
| Tauri 与 Python 通信稳定性 | 中 | sidecar 进程管理、心跳检测、自动重启 |
| 中文路径兼容性 | 中 | 全链路 UTF-8、Windows 长路径支持 |
| UG 缩略图无法生成 | 低 | 不强制生成、用文件路径关联替代 |
| GPU 环境差异 | 低 | CPU fallback 自动切换 |

---

## 十、文件组织

```
image-search/
├── src/                          # React 前端
│   ├── main.tsx                  # 入口
│   ├── App.tsx                   # 路由 + 布局
│   ├── components/               # 通用组件
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── ...
│   ├── pages/                    # 页面
│   │   ├── Home.tsx
│   │   ├── Search.tsx
│   │   ├── ImageLibrary.tsx
│   │   ├── LibraryManager.tsx
│   │   ├── ScanReport.tsx
│   │   ├── MatchManager.tsx
│   │   ├── CadFiles.tsx
│   │   ├── ExcelRecords.tsx
│   │   ├── PdfFiles.tsx
│   │   ├── Tags.tsx
│   │   ├── Favorites.tsx
│   │   ├── Settings.tsx
│   │   └── Changelog.tsx
│   ├── hooks/                    # 自定义 hooks
│   ├── services/                 # IPC 调用封装
│   ├── i18n/                     # 国际化
│   │   ├── zh.json
│   │   └── en.json
│   ├── stores/                   # 状态管理
│   └── styles/                   # 样式
│       ├── design-system.css     # 迁移自原型
│       └── dark-theme.css
├── src-tauri/                    # Tauri 配置
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       └── main.rs
├── backend/                      # Python 后端
│   ├── main.py                   # 入口
│   ├── scanner/                  # 文件扫描
│   ├── indexer/                  # 索引构建
│   │   ├── image_indexer.py
│   │   ├── cad_indexer.py
│   │   └── excel_parser.py
│   ├── search/                   # 搜索引擎
│   │   └── engine.py
│   ├── matcher/                  # 匹配引擎
│   ├── db/                       # 数据库
│   │   ├── models.py
│   │   └── manager.py
│   ├── ocr/                      # OCR 模块
│   └── models/                   # AI 模型文件
├── docs/                         # 文档
│   ├── AI-CODING-RULES.md
│   ├── DESIGN-PLAN.md            # 本文档
│   └── claude-tasks/             # 任务队列
├── scripts/                      # 自动化脚本
│   ├── claude-codex-loop.ps1
│   └── codex-review-check.ps1
├── AGENTS.md
├── CLAUDE.md
├── automation.config.json
└── package.json
```

---

## 十一、验收标准

软件完成后必须通过以下 30 项验收：

### 基础功能
1. ✅ 可以选择目标文件夹并递归扫描
2. ✅ 可以扫描 Excel 文件
3. ✅ 可以提取 Excel 表格中粘贴/插入的图片
4. ✅ Excel 内嵌图片可生成 IMG 编号
5. ✅ Excel 内嵌图片可加入图片搜索索引

### 搜索功能
6. ✅ 上传客户照片后可搜索到 Excel 中相似图片
7. ✅ 可扫描目录下所有独立图片并加入索引
8. ✅ 上传客户照片后可搜索到目录中相似图片

### CAD/UG
9. ✅ 可扫描 UG/CAD 文件，生成 CAD 编号
10. ✅ 可显示 UG/CAD 文件完整路径
11. ✅ 可自动关联图片与 UG/CAD 文件

### 匹配管理
12. ✅ 可人工修改匹配关系
13. ✅ 搜索结果必须显示 IMG 编号、图片路径、来源类型、相似度
14. ✅ Excel 来源结果显示 EX 编号、Excel 路径、工作表、行号
15. ✅ CAD 关联结果显示 CAD 编号和完整路径

### 文件操作
16. ✅ 可打开 UG/CAD 文件
17. ✅ 可打开图片所在文件夹
18. ✅ 可打开 Excel 文件
19. ✅ 可复制图片路径和 CAD/UG 路径

### 变更检测
20. ✅ 可生成扫描报告
21. ✅ 可检测新增/修改/删除/移动/改名/缺失等变化

### 数据安全
22. ✅ 可备份和恢复数据库
23. ✅ 所有功能本地运行，不上传资料

### 用户体验
24. ✅ 界面简单清楚
25. ✅ 代码完整，不省略关键代码
26. ✅ 每个模块有清晰文件结构
27. ✅ 重要功能有错误处理
28. ✅ 扫描大量文件时有进度显示
29. ✅ 人工确认过的匹配关系不被自动覆盖
30. ✅ UG 文件保持原格式，不做破坏性处理
