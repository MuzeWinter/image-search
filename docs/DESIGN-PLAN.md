# ZOOBET检索 — 设计资料图片搜索助手 设计规划文档

> 版本: v2.0  
> 日期: 2026-06-21  
> 状态: 原型阶段 → 正式开发规划  
> 核心原则: 模块化设计 · 零启动延迟 · 无等待体验  

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
- CSS 自定义属性做主题变量
- Mock 数据硬编码

### 2.3 原型迁移策略

12 个页面布局、侧边栏导航、设计系统全部保留作为 UI 参考。Mock 数据替换为真实后端接口。

---

## 三、核心架构原则：即时启动与零阻塞

### 3.1 启动时间预算

软件从双击图标到用户可交互的严格时间预算：

| 阶段 | 时间 | 内容 |
|------|------|------|
| Tauri 窗口创建 | ≤ 50ms | Rust 原生窗口，系统级速度 |
| React Shell 渲染 | ≤ 80ms | 仅侧边栏 + 顶部栏 + 空白内容区 |
| 首页静态内容 | ≤ 100ms | 导航卡片（纯文本，不需要后端数据） |
| 用户可交互 | ≤ 150ms | 可点击导航、切换页面、打开设置 |
| 后端进程启动 | 后台异步 | 不阻塞 UI |
| 数据库就绪 | 后台异步 | 不阻塞 UI |
| AI 模型加载 | 首次搜索时 | 按需加载，不启动时加载 |

**硬性要求：窗口出现 150ms 内，用户必须能看到完整界面并可以点击任意位置。**

### 3.2 禁止出现的体验

| 禁止 | 替代方案 |
|------|----------|
| ❌ 启动闪屏 / Loading 页面 | ✅ 直接显示完整 Shell |
| ❌ "正在加载..." 阻塞弹窗 | ✅ 骨架屏 + 数据渐进填充 |
| ❌ 页面切换白屏 | ✅ 即时切换 + 内容区 skeleton |
| ❌ 搜索时界面冻结 | ✅ 异步搜索 + 结果流式返回 |
| ❌ 扫描时无法操作 | ✅ 后台扫描 + 状态栏进度 |
| ❌ 首次打开加载模型 | ✅ 首次搜索时才加载，显示进度条 |
| ❌ 任何模态等待对话框 | ✅ 非模态内联状态提示 |

---

## 四、模块化架构设计

### 4.1 架构总览

```
┌──────────────────────────────────────────────────┐
│              SHELL (立即渲染, 不依赖任何后端)        │
│  ┌──────────┐  ┌───────────────────────────────┐ │
│  │ Sidebar  │  │         Content Area          │ │
│  │ 导航菜单  │  │  ┌─────────────────────────┐  │ │
│  │ 状态摘要  │  │  │  Lazy Page (按需加载)    │  │ │
│  │          │  │  │  - Search               │  │ │
│  │          │  │  │  - ImageLibrary         │  │ │
│  │          │  │  │  - LibraryManager       │  │ │
│  │          │  │  │  - ... (12 pages)       │  │ │
│  │          │  │  └─────────────────────────┘  │ │
│  └──────────┘  └───────────────────────────────┘ │
│  ┌──────────────────────────────────────────────┐ │
│  │            Status Bar (后台任务状态)           │ │
│  └──────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│              SERVICE REGISTRY (服务注册中心)        │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌───────────┐ │
│  │  DB    │ │Scanner │ │Search  │ │  Settings  │ │
│  │Service │ │Service │ │Service │ │  Service   │ │
│  └────────┘ └────────┘ └────────┘ └───────────┘ │
│  ┌────────┐ ┌────────┐ ┌────────┐               │
│  │ Indexer│ │Matcher │ │  OCR   │               │
│  │Service │ │Service │ │Service │               │
│  └────────┘ └────────┘ └────────┘               │
├──────────────────────────────────────────────────┤
│              Tauri IPC Bridge (异步)              │
├──────────────────────────────────────────────────┤
│              Python Backend (独立进程)             │
│  - 每个 Service 对应一个 Python 模块                │
│  - 按需启动，闲置可休眠                             │
│  - 重活走消息队列，不阻塞 IPC                       │
└──────────────────────────────────────────────────┘
```

### 4.2 Shell 层（启动即渲染，零依赖）

Shell 层是应用的骨架，编译到主 bundle 中，不依赖任何后端数据：

```
Shell 层文件:
├── src/
│   ├── main.tsx                    # ReactDOM.createRoot, 渲染 AppShell
│   ├── AppShell.tsx                # 主布局: Sidebar + Header + <Outlet> + StatusBar
│   ├── components/shell/
│   │   ├── Sidebar.tsx             # 纯静态导航(链接名写死), 仅依赖路由状态
│   │   ├── Header.tsx              # 窗口拖拽区 + 窗口控制按钮 + 搜索入口
│   │   ├── StatusBar.tsx           # 底部状态栏, 订阅 serviceStatus atom
│   │   └── WindowControls.tsx      # 最小化/最大化/关闭
│   ├── styles/
│   │   ├── design-system.css       # 主题变量(从原型迁移)
│   │   └── shell.css               # Shell 布局样式
│   └── i18n/
│       ├── zh.json                 # Shell 级别文本(导航名、窗口按钮提示)
│       └── en.json
```

**Shell 不包含任何页面代码。所有页面通过 React.lazy 按需加载。**

### 4.3 页面模块（独立 chunk，按需加载）

每个页面是独立的 Vite chunk，只有用户点击导航时才加载：

```
src/pages/
├── Home.tsx              # chunk-home.js      (~5KB)
├── Search.tsx            # chunk-search.js    (~15KB, 含拖拽/粘贴逻辑)
├── ImageLibrary.tsx      # chunk-images.js    (~12KB)
├── LibraryManager.tsx    # chunk-libraries.js (~10KB)
├── ScanReport.tsx        # chunk-scan.js      (~8KB)
├── MatchManager.tsx      # chunk-matches.js   (~10KB)
├── CadFiles.tsx          # chunk-cad.js       (~8KB)
├── ExcelRecords.tsx      # chunk-excel.js     (~8KB)
├── PdfFiles.tsx          # chunk-pdf.js       (~8KB)
├── Tags.tsx              # chunk-tags.js      (~6KB)
├── Favorites.tsx         # chunk-fav.js       (~6KB)
├── Settings.tsx          # chunk-settings.js  (~10KB)
└── Changelog.tsx         # chunk-changelog.js (~6KB)
```

每个页面的数据加载模式：

```typescript
// 页面组件的标准模式
function ImageLibraryPage() {
  // 1. 立即渲染骨架屏
  // 2. 异步请求数据 (不阻塞渲染)
  // 3. 数据到达后填充内容
  const { data, loading, error } = useServiceQuery('imageService', 'listImages', { page: 1 });

  if (loading) return <ImageLibrarySkeleton />;  // 骨架屏，不是 spinner
  if (error) return <InlineError message={error} onRetry={refetch} />;
  return <ImageLibraryContent data={data} />;
}
```

### 4.4 服务层（Service Registry 模式）

每个后端能力封装为独立服务，统一注册、按需启动：

```
src/services/
├── registry.ts             # 服务注册中心
├── types.ts                # 所有服务接口的 TypeScript 类型
├── dbService.ts            # 数据库查询服务
├── libraryService.ts       # 资料库管理
├── scanService.ts          # 扫描服务(含进度流)
├── searchService.ts        # 搜索服务
├── imageService.ts         # 图片 CRUD
├── cadService.ts           # CAD 文件服务
├── excelService.ts         # Excel 记录服务
├── pdfService.ts           # PDF 文件服务
├── matchService.ts         # 匹配管理服务
├── tagService.ts           # 标签服务
├── settingsService.ts      # 设置读写
├── systemService.ts        # 系统操作(打开文件/文件夹)
└── modelService.ts         # AI 模型状态管理
```

**服务注册中心设计：**

```typescript
// services/registry.ts
interface ServiceDescriptor {
  name: string;
  status: 'idle' | 'starting' | 'ready' | 'error';
  start: () => Promise<void>;      // 启动服务(幂等)
  invoke: <T>(method: string, params?: any) => Promise<T>;
  stop?: () => Promise<void>;      // 可选: 闲置时释放资源
}

class ServiceRegistry {
  private services = new Map<string, ServiceDescriptor>();

  register(desc: ServiceDescriptor): void;
  get(name: string): ServiceDescriptor | undefined;
  ensureReady(name: string): Promise<ServiceDescriptor>;  // 自动启动
  getStatus(name: string): 'idle' | 'starting' | 'ready' | 'error';
  shutdown(): Promise<void>;
}
```

**服务启动时机：**

| 服务 | 启动时机 | 启动方式 |
|------|----------|----------|
| dbService | 应用启动后 100ms | 自动后台启动 |
| settingsService | 应用启动后 50ms | 自动后台启动 |
| libraryService | 首次访问资料库页面 | 按需启动 |
| scanService | 用户点击扫描 | 按需启动 |
| searchService | 用户首次搜索 | 按需启动(含模型加载) |
| modelService | searchService 启动时 | 自动级联启动 |
| 其他 CRUD 服务 | 首次访问对应页面 | 按需启动 |

### 4.5 状态管理（原子化，不阻塞渲染）

使用 Jotai（原子化状态管理），每个状态独立订阅：

```typescript
// stores/atoms.ts
import { atom } from 'jotai';

// 服务状态（全局）
export const serviceStatusAtom = atom<Record<string, ServiceStatus>>({});

// 资料库列表（后台加载，初始空数组）
export const librariesAtom = atom<Library[]>([]);

// 扫描进度（后台更新）
export const scanProgressAtom = atom<ScanProgress | null>(null);

// 搜索状态（独立原子）
export const searchQueryAtom = atom<SearchQuery | null>(null);
export const searchResultsAtom = atom<SearchResult[]>([]);
export const searchLoadingAtom = atom(false);

// 主题/语言（从 settingsService 同步，有本地缓存兜底）
export const themeAtom = atomWithStorage<'light' | 'dark' | 'system'>('theme', 'light');
export const localeAtom = atomWithStorage<'zh' | 'en'>('locale', 'zh');
```

**关键原则：每个 atom 初始值立即可用，不需要等待后端。**

---

## 五、启动流程详细设计

### 5.1 冷启动时序（精确到毫秒）

```
t=0ms    用户双击 exe
t=10ms   Tauri 创建原生窗口 (Rust 层, 系统调用)
t=30ms   WebView 初始化, 加载 index.html
t=50ms   React 开始渲染 <AppShell>
t=60ms   Sidebar + Header 渲染完成 (纯静态 HTML/CSS)
t=80ms   首页导航卡片渲染完成 (纯文本, 无数据依赖)
t=100ms  窗口完整显示, 用户可点击导航
t=120ms  settingsService.start() 后台读取配置(本地文件, <5ms)
t=150ms  主题/语言生效 (从 localStorage 恢复, 无需等后端)
t=200ms  dbService.start() 后台打开 SQLite
t=300ms  libraryService 后台查询资料库列表(有数据就填充, 无数据显示空状态)
t=500ms  StatusBar 显示 "就绪"
```

### 5.2 热启动（数据库已有数据）

```
t=0ms    用户双击 exe
t=50ms   窗口显示, 用户可交互
t=80ms   从 SQLite 读取资料库列表 (缓存优先)
t=100ms  首页统计数字出现 (图片数/文件数)
t=150ms  StatusBar 显示 "资料库 3 个 · 已索引 1243 张 · 就绪"
```

### 5.3 关键实现细节

**localStorage 作为 UI 状态的一级缓存：**

```typescript
// 主题/语言从 localStorage 恢复，不依赖后端
const [theme, setTheme] = useAtom(themeAtom);     // atomWithStorage → 立即可用
const [locale, setLocale] = useAtom(localeAtom);  // atomWithStorage → 立即可用

// 上一次窗口位置/大小
const [windowBounds, setWindowBounds] = useAtom(windowBoundsAtom);
```

**数据库查询不阻塞渲染：**

```typescript
// Home.tsx - 首页统计数字
function HomePage() {
  // useServiceQuery: 立即返回 { data: null, loading: true }
  // 不阻塞组件渲染
  const stats = useServiceQuery('dbService', 'getStats');

  return (
    <div>
      <WelcomeBanner />
      <StatsGrid>
        {stats.loading
          ? <StatsSkeleton />           // 骨架占位，不是 spinner
          : <StatsValues data={stats.data} />
        }
      </StatsGrid>
      <NavigationCards />               // 始终显示，不依赖后端数据
    </div>
  );
}
```

**AI 模型懒加载：**

```typescript
// searchService.ts
class SearchService {
  private modelReady = false;

  async search(params: SearchParams): Promise<SearchResult[]> {
    if (!this.modelReady) {
      // 首次搜索：加载模型 + 显示进度
      await this.loadModel((progress) => {
        // 前端通过 IPC 事件接收进度
        emit('model-loading-progress', progress); // 0.0 → 1.0
      });
      this.modelReady = true;
    }
    return this.performSearch(params);
  }
}
```

---

## 六、技术架构

### 6.1 技术选型

| 层 | 技术 | 原因 |
|----|------|------|
| 桌面框架 | **Tauri v2** | 窗口创建 <50ms，Rust 内核，体积小 |
| 前端 | **React 18 + TypeScript** | Suspense + lazy 实现按需加载 |
| 前端构建 | **Vite** | 代码分割原生支持，HMR 快 |
| 状态管理 | **Jotai** | 原子化，按需订阅，零额外重渲染 |
| 路由 | **React Router v6** | lazy 路由内置支持 |
| IPC 通信 | **Tauri invoke + Event** | 双向异步，事件流支持 |
| 后端 | **Python 3.11+** (sidecar) | AI 生态完整 |
| 图搜模型 | **OpenCLIP** (ViT-B/32) | 本地运行，中文支持 |
| 向量检索 | **FAISS** | 毫秒级检索 |
| OCR | **PaddleOCR** | 中文 OCR 最优 |
| 数据库 | **SQLite** (WAL 模式) | 零延迟打开，读写并发 |

### 6.2 前端依赖（最小化原则）

```json
{
  "dependencies": {
    "react": "^18.3",
    "react-dom": "^18.3",
    "react-router-dom": "^6",
    "jotai": "^2",
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-shell": "^2",
    "@tauri-apps/plugin-dialog": "^2"
  },
  "devDependencies": {
    "typescript": "^5",
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "@tauri-apps/cli": "^2"
  }
}
```

**刻意不引入：** UI 组件库（自定义）、状态管理重型方案、CSS-in-JS（用原生 CSS 变量）。

---

## 七、数据库设计

### 7.1 表结构

```sql
-- 资料库
CREATE TABLE libraries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    path        TEXT NOT NULL UNIQUE,
    label       TEXT,
    file_count  INTEGER DEFAULT 0,
    image_count INTEGER DEFAULT 0,
    last_scan   TEXT,
    status      TEXT DEFAULT 'idle',
    created_at  TEXT DEFAULT (datetime('now','localtime'))
);

-- 图片索引
CREATE TABLE images (
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

-- Excel 记录
CREATE TABLE excel_records (
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

-- CAD/UG 文件
CREATE TABLE cad_files (
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

-- PDF 文件
CREATE TABLE pdf_files (
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

-- 匹配关系
CREATE TABLE matches (
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

-- 扫描历史
CREATE TABLE scan_history (
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

-- 变更日志
CREATE TABLE change_logs (
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

-- 设置 (key-value)
CREATE TABLE settings (
    key          TEXT PRIMARY KEY,
    value        TEXT
);

-- 搜索历史
CREATE TABLE search_history (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    query_image  TEXT,
    result_count INTEGER,
    duration_ms  INTEGER,
    searched_at  TEXT DEFAULT (datetime('now','localtime'))
);
```

### 7.2 数据库性能要求

| 指标 | 要求 | 实现方式 |
|------|------|----------|
| 打开数据库 | <5ms | SQLite 单文件，无网络连接 |
| 首页统计查询 | <10ms | 聚合查询，适当索引 |
| 列表分页（50条） | <20ms | LIMIT + OFFSET + 索引 |
| 写入单条记录 | <5ms | WAL 模式，批量事务 |

---

## 八、IPC 接口设计（前端 ↔ 后端）

### 8.1 通信协议

```
前端 invoke("service.method", { params })
  → Tauri IPC (JSON 序列化)
    → Rust 转发
      → Python sidecar (stdin/stdout JSON-RPC)
        → 返回结果
          → Rust 转发
            → 前端 Promise resolve
```

### 8.2 核心接口

```typescript
// 资料库
invoke("library.list")                   → Library[]
invoke("library.add", {path, label})      → Library
invoke("library.remove", {id})           → void
invoke("library.scan", {id, type})       → {taskId: string}  // 返回任务 ID，进度通过事件推送

// 图片
invoke("image.list", {page, pageSize, filters?}) → {images: Image[], total: number}
invoke("image.get", {imgId})             → ImageDetail
invoke("image.update", {imgId, ...})     → Image
invoke("image.delete", {imgId})          → void
invoke("image.toggleFavorite", {imgId})  → Image

// 搜索
invoke("search.byImage", {imagePath, topK}) → SearchResult[]
invoke("search.modelStatus")             → {loaded: boolean, progress?: number}

// CAD / Excel / PDF
invoke("cad.list", {...})                → {files: CadFile[], total: number}
invoke("excel.list", {...})              → {records: ExcelRecord[], total: number}
invoke("pdf.list", {...})                → {files: PdfFile[], total: number}

// 匹配
invoke("match.list", {filters?})         → Match[]
invoke("match.confirm", {id})            → Match
invoke("match.reject", {id})             → Match
invoke("match.create", {...})            → Match
invoke("match.remove", {id})             → void

// 设置
invoke("settings.get", {key})            → string | null
invoke("settings.getAll")                → Record<string, string>
invoke("settings.set", {key, value})     → void

// 系统
invoke("system.openFile", {path})        → void
invoke("system.openFolder", {path})      → void
invoke("system.copyPath", {path})        → void
invoke("system.healthCheck")             → HealthStatus
```

### 8.3 事件流（后端 → 前端推送）

```
// Tauri 事件监听
listen("scan:progress", (e) => { ... });     // 扫描进度实时更新
listen("scan:complete", (e) => { ... });     // 扫描完成通知
listen("model:loading", (e) => { ... });     // AI 模型加载进度
listen("model:ready", (e) => { ... });       // AI 模型就绪
listen("service:status", (e) => { ... });    // 服务状态变更
```

---

## 九、UI/UX 设计规范

### 9.1 窗口设计

- 无标题栏一体化设计
- 自定义顶部栏（拖拽区 + 窗口控制按钮）
- 左侧导航栏（260px）
- 内容区自适应
- 底部状态栏（30px，显示后台任务）
- 最小窗口 1024×680
- 深色/浅色主题完整适配

### 9.2 骨架屏（Skeleton）规范

任何数据加载状态使用骨架屏，不使用居中 spinner：

```
列表骨架屏:
┌──────────────────────────────┐
│ ████████████  ████  ████████ │  ← 灰色脉冲矩形代替文字
│ ████████████  ████  ████████ │
│ ████████████  ████  ████████ │
└──────────────────────────────┘

卡片骨架屏:
┌─────────┐ ┌─────────┐ ┌─────────┐
│ ███████ │ │ ███████ │ │ ███████ │
│ ██████  │ │ ██████  │ │ ██████  │
│ ████    │ │ ████    │ │ ████    │
└─────────┘ └─────────┘ └─────────┘
```

### 9.3 状态栏

底部状态栏始终可见，不弹窗打断用户：

```
状态栏示例:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
资料库 3 个 · 已索引 1243 张 · 就绪           🔄 正在扫描 D:\设计资料库... 45%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 9.4 主题变量

```css
:root {
  --bg-primary / --bg-secondary
  --surface / --surface-hover / --surface-active
  --fg / --muted
  --border / --border-heavy
  --accent
  --success / --warning / --danger / --info
  --skeleton-base / --skeleton-shine   /* 骨架屏颜色 */
}
```

### 9.5 字体

- 标题: `Iowan Old Style / Charter / Georgia` (衬线)
- 正文: `Segoe UI / system-ui` (无衬线)
- 编号/代码: `JetBrains Mono / Menlo` (等宽)

---

## 十、文件组织

```
image-search/
├── src/                              # React 前端
│   ├── main.tsx                      # 入口, 仅渲染 AppShell + Router
│   ├── AppShell.tsx                  # 主布局
│   ├── components/
│   │   ├── shell/                    # Shell 层组件(主 bundle)
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   ├── StatusBar.tsx
│   │   │   └── WindowControls.tsx
│   │   └── shared/                   # 共享组件(lazy chunk)
│   │       ├── Skeleton.tsx          # 骨架屏组件
│   │       ├── InlineError.tsx       # 内联错误提示
│   │       ├── EmptyState.tsx        # 空状态
│   │       ├── ConfirmDialog.tsx
│   │       └── TagBadge.tsx
│   ├── pages/                        # 页面(每个独立 chunk)
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
│   ├── services/                     # 服务层
│   │   ├── registry.ts              # 服务注册中心
│   │   ├── types.ts                 # 类型定义
│   │   ├── dbService.ts
│   │   ├── libraryService.ts
│   │   ├── scanService.ts
│   │   ├── searchService.ts
│   │   ├── imageService.ts
│   │   ├── cadService.ts
│   │   ├── excelService.ts
│   │   ├── pdfService.ts
│   │   ├── matchService.ts
│   │   ├── tagService.ts
│   │   ├── settingsService.ts
│   │   ├── systemService.ts
│   │   └── modelService.ts
│   ├── stores/                       # Jotai atoms
│   │   ├── atoms.ts                  # 全局状态
│   │   └── hooks.ts                  # 自定义 hooks
│   ├── i18n/
│   │   ├── zh.json
│   │   └── en.json
│   └── styles/
│       ├── design-system.css         # 主题变量 + 基础样式
│       ├── shell.css                 # Shell 布局
│       ├── skeleton.css              # 骨架屏动画
│       └── dark-theme.css            # 深色主题覆盖
├── src-tauri/                        # Tauri 配置
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── src/
│       └── main.rs                   # 窗口管理 + IPC 转发 + sidecar 启动
├── backend/                          # Python 后端
│   ├── main.py                       # JSON-RPC 入口 + 服务注册
│   ├── services/                     # 服务模块(对应前端 services/)
│   │   ├── db_service.py
│   │   ├── library_service.py
│   │   ├── scan_service.py
│   │   ├── search_service.py
│   │   ├── model_service.py
│   │   ├── image_service.py
│   │   ├── cad_service.py
│   │   ├── excel_service.py
│   │   ├── pdf_service.py
│   │   ├── match_service.py
│   │   └── ocr_service.py
│   ├── db/
│   │   ├── schema.sql               # 建表语句
│   │   └── connection.py            # 连接池
│   └── models/                       # AI 模型文件(内置)
├── docs/
│   ├── DESIGN-PLAN.md                # 本文档
│   └── claude-tasks/                 # 任务队列
├── scripts/
│   ├── claude-codex-loop.ps1
│   └── codex-review-check.ps1
├── AGENTS.md
├── CLAUDE.md
├── automation.config.json
└── package.json
```

---

## 十一、实施路线图

### Phase 1: 即时启动 Shell (1 周)

**目标: 双击后 150ms 内显示完整界面**

- Tauri v2 项目初始化，窗口无标题栏
- React + Vite 配置，代码分割配置
- `AppShell.tsx`：Sidebar + Header + StatusBar
- 所有页面占位（`React.lazy` + `Suspense`）
- 主题变量从原型迁移
- 窗口控制按钮（最小化/最大化/关闭）
- i18n 框架 + Shell 文本翻译
- **验收：双击 exe → 150ms 内出现完整界面，可点击导航切换空白页**

### Phase 2: 服务注册中心 + 数据库 (1 周)

**目标: 后台服务框架就绪，数据可读写**

- `ServiceRegistry` 实现
- `dbService`：SQLite 建表 + 连接
- `settingsService`：配置读写 + localStorage 同步
- `libraryService`：资料库 CRUD
- 首页统计数字真实查询
- 骨架屏组件库
- **验收：启动后状态栏显示资料库数量，设置页可修改主题/语言并保存**

### Phase 3: 资料库管理 + 扫描 (2 周)

**目标: 可添加资料库、扫描文件、查看进度**

- 资料库管理页面（添加/删除/打开文件夹）
- 扫描服务（递归扫描、文件类型识别）
- 扫描进度实时推送（事件流）
- 扫描报告页面
- Excel 内嵌图片提取
- 图片/CAD/PDF 编号生成
- **验收：添加文件夹 → 扫描 → 进度条实时更新 → 扫描报告显示统计**

### Phase 4: 图片索引 + AI 搜索 (2 周)

**目标: 以图搜图真实可用**

- `modelService`：OpenCLIP 模型管理（首次加载进度）
- `searchService`：图片特征提取 + FAISS 搜索
- 图片库页面（CRUD + 筛选 + 排序）
- 搜索页面（拖拽/粘贴/截图 → 结果列表）
- 搜索结果详情（来源类型/编号/路径/相似度）
- **验收：拖入图片 → 模型加载进度 → 搜索结果列表 → 显示关联信息**

### Phase 5: CAD/Excel/PDF 管理 (1 周)

- CAD 文件列表页面
- Excel 记录列表页面
- PDF 文件列表页面
- 打开文件/打开文件夹/复制路径
- 自动关联引擎（同目录/同文件名/Excel引用）

### Phase 6: 匹配管理 + 标签 + 收藏 (1 周)

- 匹配管理页面（查看/确认/修改/解除）
- 标签分类页面
- 收藏功能
- 变更记录页面

### Phase 7: 完善与打包 (1 周)

- 深色主题完整适配
- 中英文完整翻译
- 首次启动引导
- 错误处理全覆盖
- .msi/.exe 打包
- 离线运行验证

---

## 十二、每阶段统一验收模式

每个 Phase 完成后必须通过以下验收，不可跳过：

### 启动验收
1. 双击 exe，计时到窗口完整可见
2. 窗口出现后立即点击侧边栏导航，页面是否切换
3. 切换深色/浅色主题，全界面是否即时生效
4. 关闭软件重新打开，主题/语言/窗口位置是否保留

### 功能验收
5. Phase 目标功能是否真实可用（不靠 mock 数据）
6. 操作后是否有成功/失败反馈
7. 错误状态是否友好提示（不崩溃、不白屏）

### 性能验收
8. 操作过程中界面是否响应（不卡顿、不冻结）
9. 后台任务进行中，是否可以切换到其他页面正常使用

---

## 十三、关键风险与对策

| 风险 | 等级 | 对策 |
|------|------|------|
| Python sidecar 启动延迟 | 中 | Shell 先渲染，sidecar 后台启动，状态栏显示进度 |
| OpenCLIP 首次加载慢(3-10秒) | 中 | 首次搜索时才加载，显示进度条，不阻塞其他操作 |
| 大量文件扫描卡 UI | 高 | 异步扫描 + 事件流推送进度 + 支持暂停/中断 |
| FAISS 索引内存占用 | 中 | 分批索引、磁盘索引模式可选 |
| 中文路径兼容性 | 中 | 全链路 UTF-8 |
| 首次启动数据库为空 | 低 | 空状态友好引导，不是空白页 |

---

## 十四、验收标准（30 项）

### 基础功能
1. ✅ 选择目标文件夹并递归扫描
2. ✅ 扫描 Excel 文件
3. ✅ 提取 Excel 表格中粘贴/插入的图片
4. ✅ Excel 内嵌图片生成 IMG 编号
5. ✅ Excel 内嵌图片加入图片搜索索引

### 搜索功能
6. ✅ 上传客户照片后可搜索到 Excel 中相似图片
7. ✅ 扫描目录下所有独立图片并加入索引
8. ✅ 上传客户照片后可搜索到目录中相似图片

### CAD/UG
9. ✅ 扫描 UG/CAD 文件，生成 CAD 编号
10. ✅ 显示 UG/CAD 文件完整路径
11. ✅ 自动关联图片与 UG/CAD 文件

### 匹配管理
12. ✅ 人工修改匹配关系
13. ✅ 搜索结果显示 IMG 编号、路径、来源类型、相似度
14. ✅ Excel 来源显示 EX 编号、Excel 路径、工作表、行号
15. ✅ CAD 关联显示 CAD 编号和完整路径

### 文件操作
16. ✅ 打开 UG/CAD 文件
17. ✅ 打开图片所在文件夹
18. ✅ 打开 Excel 文件
19. ✅ 复制图片路径和 CAD/UG 路径

### 变更检测
20. ✅ 生成扫描报告
21. ✅ 检测新增/修改/删除/移动/改名/缺失等变化

### 数据安全
22. ✅ 备份和恢复数据库
23. ✅ 所有功能本地运行，不上传资料

### 用户体验
24. ✅ 界面简单清楚
25. ✅ 代码完整，不省略关键代码
26. ✅ 每个模块有清晰文件结构
27. ✅ 重要功能有错误处理
28. ✅ 扫描大量文件时有进度显示
29. ✅ 人工确认过的匹配关系不被自动覆盖
30. ✅ UG 文件保持原格式，不做破坏性处理

### 性能体验（新增）
31. ✅ 双击 exe 后 150ms 内窗口完整可见
32. ✅ 启动过程中无任何 Loading 页面或阻塞弹窗
33. ✅ 页面切换即时响应，无白屏
34. ✅ 后台任务进行中，界面可正常操作其他功能
35. ✅ AI 模型加载不阻塞界面，有非模态进度提示
