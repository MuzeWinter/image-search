# ZOOBET 智能检索 — 开发指南

## 目录

- [1. 架构总览](#1-架构总览)
- [2. 技术栈](#2-技术栈)
- [3. 项目结构](#3-项目结构)
- [4. 前端架构](#4-前端架构)
- [5. 后端架构](#5-后端架构)
- [6. IPC 通信](#6-ipc-通信)
- [7. 数据库](#7-数据库)
- [8. 构建与打包](#8-构建与打包)
- [9. 测试](#9-测试)
- [10. 调试](#10-调试)
- [11. CI/CD](#11-cicd)

---

## 1. 架构总览

```
┌──────────────────────────────────────────────────┐
│                  React 前端 (Vite)                 │
│  ┌──────────┐  ┌───────────────────────────────┐ │
│  │  Shell   │  │       Pages (Lazy Loaded)     │ │
│  │ Sidebar  │  │  Search / Library / Settings   │ │
│  │ Header   │  │                               │ │
│  │StatusBar │  │  Contexts: Theme/I18n/Toast    │ │
│  └──────────┘  └───────────────────────────────┘ │
│  ┌──────────────────────────────────────────────┐ │
│  │          Service Registry (IPC 调用层)        │ │
│  └──────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────┤
│              Tauri v2 IPC Bridge (Rust)           │
├──────────────────────────────────────────────────┤
│           Python Backend (独立 sidecar 进程)       │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌───────────┐ │
│  │ DB     │ │Scanner │ │Search  │ │ Settings   │ │
│  │Service │ │Service │ │Service │ │ Service    │ │
│  └────────┘ └────────┘ └────────┘ └───────────┘ │
│  ┌────────┐ ┌────────┐ ┌────────┐               │
│  │ AI     │ │ Excel  │ │  UG    │               │
│  │Service │ │Service │ │Service │               │
│  └────────┘ └────────┘ └────────┘               │
├──────────────────────────────────────────────────┤
│              SQLite (WAL 模式)                    │
└──────────────────────────────────────────────────┘
```

**核心设计原则：**

- **即时启动**：Shell 层无任何后端依赖，150ms 内可交互
- **按需加载**：页面通过 `React.lazy` 代码分割；AI 模型首次搜索时才加载
- **异步非阻塞**：扫描、搜索、文件操作全部异步，不阻塞 UI
- **模块化服务**：前后端均按功能拆分为独立服务模块

---

## 2. 技术栈

### 桌面框架
- **Tauri v2**：Rust 原生窗口，启动 <50ms
- 自定义无标题栏窗口，支持拖拽、最小化/最大化/关闭

### 前端
- **React 18** + **TypeScript 5**：严格模式
- **Vite 5**：构建工具，代码分割原生支持
- **Jotai 2**：原子化状态管理
- **React Router v6**：懒加载路由
- **react-window**：虚拟滚动优化大列表

### 后端
- **Python 3.11+**：通过 JSON-RPC 2.0 与前端通信
- **OpenCLIP ViT-B/32**：视觉特征提取（512 维向量）
- **FAISS**：向量相似度搜索（IndexFlatIP 内积）
- **EasyOCR**：中英文 OCR 文字识别
- **openpyxl / xlrd**：Excel 文件解析与内嵌图片提取
- **NXOpen**（可选）：Siemens NX .prt 文件预览图导出

### 数据库
- **SQLite**：WAL 模式，11 张表，线程本地连接

### 刻意不引入
- UI 组件库（自定义组件）
- CSS-in-JS（CSS 自定义属性实现主题）
- 重量级状态管理（Jotai 足够）

---

## 3. 项目结构

```
Image Search/
├── src/                          # React 前端
│   ├── main.tsx                  # 入口：ReactDOM + AppShell + Router
│   ├── AppShell.tsx              # 主布局：Sidebar + Header + Outlet + StatusBar
│   ├── components/
│   │   ├── shell/                # Shell 层组件（主 bundle，不懒加载）
│   │   │   ├── Sidebar.tsx       # 侧边导航
│   │   │   ├── Header.tsx        # 顶部拖拽栏 + 窗口控制
│   │   │   ├── StatusBar.tsx     # 底部状态栏
│   │   │   └── WindowControls.tsx # 最小化/最大化/关闭按钮
│   │   └── shared/               # 共享组件（按需加载）
│   │       ├── Toast.tsx         # Toast 通知
│   │       ├── Skeleton.tsx      # 骨架屏
│   │       ├── EmptyState.tsx    # 空状态
│   │       ├── ConfirmDialog.tsx # 确认对话框
│   │       ├── WelcomeGuide.tsx  # 首次启动向导
│   │       ├── ErrorReport.tsx   # 错误报告对话框
│   │       └── ImageCompare.tsx  # 图片对比
│   ├── pages/                    # 页面（React.lazy 独立 chunk）
│   │   ├── Search.tsx            # 搜索页
│   │   ├── Library.tsx           # 资料库管理页
│   │   └── Settings.tsx          # 设置页
│   ├── services/                 # 前端服务层
│   │   ├── registry.ts           # ServiceRegistry：服务生命周期管理
│   │   ├── types.ts              # IPC 接口类型定义
│   │   ├── searchService.ts      # 搜索服务
│   │   ├── libraryService.ts     # 资料库服务
│   │   ├── scanService.ts        # 扫描服务
│   │   ├── settingsService.ts    # 设置服务
│   │   └── systemService.ts      # 系统服务
│   ├── contexts/                 # React Context
│   │   ├── ThemeContext.tsx       # 主题管理
│   │   ├── I18nContext.tsx        # 国际化
│   │   └── ToastContext.tsx       # Toast 管理
│   ├── i18n/
│   │   ├── zh.json               # 中文翻译（313 键）
│   │   └── en.json               # 英文翻译
│   └── styles/
│       ├── design-system.css     # 主题变量 + 基础样式
│       ├── shell.css             # Shell 布局
│       ├── search.css            # 搜索页样式
│       ├── toast.css             # Toast 动画
│       └── welcome.css           # 欢迎向导样式
├── src-tauri/                    # Tauri Rust 后端
│   ├── Cargo.toml                # Rust 依赖
│   ├── tauri.conf.json           # Tauri 配置（窗口、sidecar、权限）
│   ├── capabilities/             # 权限配置
│   └── src/
│       └── main.rs               # Rust 命令：call_backend / scan_library / open_file / ...
├── backend/                      # Python 后端
│   ├── main.py                   # JSON-RPC 入口，stdin/stdout 通信
│   ├── services/                 # 服务模块
│   │   ├── __init__.py
│   │   ├── db_service.py         # 数据库 CRUD
│   │   ├── library_service.py    # 资料库管理
│   │   ├── scan_service.py       # 扫描管线
│   │   ├── search_service.py     # 搜索管线
│   │   ├── ai_service.py         # AI 模型管理（OpenCLIP）
│   │   ├── excel_service.py      # Excel 解析与图片提取
│   │   ├── ug_service.py         # NXOpen UG 预览提取
│   │   ├── ocr_service.py        # OCR 文字识别
│   │   ├── settings_service.py   # 设置管理
│   │   ├── system_service.py     # 系统操作
│   │   └── error_report_service.py # 错误报告生成
│   └── db/
│       ├── schema.sql            # 建表语句
│       └── connection.py         # 数据库连接管理
├── scripts/
│   ├── check.mjs                 # npm run check 汇总脚本
│   ├── build-release.mjs         # 发布构建脚本
│   ├── build-msi.ps1             # MSI 打包脚本
│   ├── claude-codex-loop.ps1     # 自动化任务循环
│   └── codex-review-check.ps1    # 代码审查脚本
├── docs/
│   ├── USER-GUIDE.md             # 用户指南
│   ├── DEV-GUIDE.md              # 本文档
│   ├── CHANGELOG.md              # 版本记录
│   ├── DESIGN-PLAN.md            # 设计规划
│   ├── FEATURES.md               # 功能清单
│   └── claude-tasks/             # 自动化任务队列
├── AGENTS.md                     # Codex 规则
├── CLAUDE.md                     # Claude Code 规则
├── package.json                  # 前端依赖与脚本
└── requirements.txt              # Python 依赖
```

---

## 4. 前端架构

### 4.1 Shell 层

Shell 层是应用的骨架，编译到主 bundle 中，不依赖任何后端数据。启动后 150ms 内完整渲染。

```
ReactDOM.createRoot
  └── AppShell
       ├── Sidebar        ← 纯静态导航，仅依赖路由
       ├── Header         ← 窗口拖拽区 + 窗口控制
       ├── <Outlet />     ← 页面内容（React.lazy）
       └── StatusBar      ← 订阅 serviceStatus atom
```

### 4.2 页面加载

所有页面通过 `React.lazy + Suspense + ErrorBoundary` 按需加载：

```typescript
// 路由配置
const Search = lazy(() => import('./pages/Search'));
const Library = lazy(() => import('./pages/Library'));
const Settings = lazy(() => import('./pages/Settings'));

// Suspense fallback 使用 Skeleton，不是 spinner
<Suspense fallback={<PageSkeleton />}>
  <Routes>
    <Route path="/search" element={<Search />} />
    <Route path="/library" element={<Library />} />
    <Route path="/settings" element={<Settings />} />
  </Routes>
</Suspense>
```

### 4.3 状态管理 (Jotai)

原子化状态管理，每个原子独立订阅，避免不必要重渲染：

```typescript
// 主题/语言 → atomWithStorage，从 localStorage 恢复，立即可用
export const themeAtom = atomWithStorage<'light' | 'dark' | 'system'>('theme', 'light');
export const localeAtom = atomWithStorage<'zh' | 'en'>('locale', 'zh');

// 服务状态 → 后台加载，初始空值
export const librariesAtom = atom<Library[]>([]);
export const searchResultsAtom = atom<SearchResult[]>([]);
export const scanProgressAtom = atom<ScanProgress | null>(null);
```

**关键原则：每个 atom 初始值立即可用，不等待后端。**

### 4.4 服务层 (ServiceRegistry)

封装所有后端 IPC 调用，统一管理服务生命周期：

```typescript
interface ServiceDescriptor {
  name: string;
  status: 'idle' | 'starting' | 'ready' | 'error';
  start: () => Promise<void>;
  invoke: <T>(method: string, params?: unknown) => Promise<T>;
}

class ServiceRegistry {
  register(desc: ServiceDescriptor): void;
  ensureReady(name: string): Promise<ServiceDescriptor>;
  getStatus(name: string): ServiceStatus;
}
```

**服务启动时机：**
- `settingsService`：应用启动后 50ms
- `dbService`：应用启动后 100ms
- `libraryService`：首次访问资料库页面
- `searchService`：用户首次搜索（级联加载 AI 模型）

### 4.5 国际化 (i18n)

- 313 个翻译键，dot 分隔命名（如 `search.dropZone.title`）
- 支持参数插值：`"found {{count}} results"` → `"找到 5 个结果"`
- `I18nContext` 提供 `t(key, params?)` 函数
- 所有用户可见文字走 i18n，组件中不硬编码文本

### 4.6 主题系统

通过 CSS 自定义属性实现，切换主题时更换根元素 class：

```css
:root {
  --bg-primary: #ffffff;
  --fg: #1a1a1a;
  --accent: #3b82f6;
  --border: #e5e7eb;
}

[data-theme="dark"] {
  --bg-primary: #111827;
  --fg: #f3f4f6;
  --border: #374151;
}
```

---

## 5. 后端架构

### 5.1 通信协议

Python 后端作为 Tauri sidecar 进程运行，通过 stdin/stdout 使用 JSON-RPC 2.0 协议通信：

```
前端 invoke("call_backend", { method, params })
  → Tauri IPC (JSON)
    → Rust main.rs: call_backend()
      → Python sidecar stdin
        → JSON-RPC 路由
          → 返回 JSON
            → Rust stdout 读取
              → 前端 Promise resolve
```

### 5.2 JSON-RPC 入口 (main.py)

```python
# 请求格式
{"jsonrpc": "2.0", "method": "service.method", "params": {...}, "id": 1}

# 响应格式
{"jsonrpc": "2.0", "result": {...}, "id": 1}

# 错误格式
{"jsonrpc": "2.0", "error": {"code": -32000, "message": "..."}, "id": 1}
```

方法名格式为 `service.method`，由路由层分发到对应服务模块。

### 5.3 服务模块

| 服务 | 文件 | 职责 |
|------|------|------|
| `db_service` | `db_service.py` | 数据库连接管理、CRUD 操作 |
| `library_service` | `library_service.py` | 资料库增删改查 |
| `scan_service` | `scan_service.py` | 7 阶段扫描管线 |
| `search_service` | `search_service.py` | 图片搜索管线（特征提取 + FAISS） |
| `ai_service` | `ai_service.py` | OpenCLIP 模型加载、特征提取 |
| `excel_service` | `excel_service.py` | Excel 解析、内嵌图片提取 |
| `ug_service` | `ug_service.py` | NXOpen .prt 预览提取 |
| `ocr_service` | `ocr_service.py` | EasyOCR 文字识别 |
| `settings_service` | `settings_service.py` | 设置读写 |
| `system_service` | `system_service.py` | 系统信息、诊断、文件操作 |
| `error_report_service` | `error_report_service.py` | 错误报告 .zip 生成 |

### 5.4 扫描管线

```
scan_service.py
  ├── collect_files()      # 递归遍历，收集文件列表
  ├── compute_hashes()     # SHA256 哈希
  ├── compare_with_db()    # 与数据库比对，识别变更
  ├── detect_moves()       # 检测文件移动
  ├── save_to_db()         # 写入数据库
  ├── extract_excel()      # 提取 Excel 内嵌图片
  └── extract_ug()         # NXOpen 导出 UG 预览
       └── auto_index()    # AI 特征提取 + FAISS 索引
```

---

## 6. IPC 通信

### 6.1 Tauri 命令 (Rust → 前端)

```rust
// src-tauri/src/main.rs
#[tauri::command]
async fn call_backend(method: String, params: Value) -> Result<Value, String> {
    // 发送 JSON-RPC 请求到 Python sidecar
    // 返回解析后的 result
}

#[tauri::command]
async fn open_file(path: String) -> Result<(), String> { ... }

#[tauri::command]
async fn open_folder(path: String) -> Result<(), String> { ... }
```

### 6.2 事件流 (后端 → 前端推送)

```typescript
// 前端监听
import { listen } from '@tauri-apps/api/event';

listen('scan:progress', (e) => { /* 扫描进度 */ });
listen('scan:complete', (e) => { /* 扫描完成 */ });
listen('model:loading', (e) => { /* 模型加载进度 */ });
listen('model:ready', (e) => { /* 模型就绪 */ });
```

### 6.3 新增 IPC 接口规范

新增接口时必须保持前后端一致：

1. 前端 `services/types.ts` 定义参数和返回值类型
2. 前端 service 添加 `invoke` 调用
3. Rust `main.rs` 注册命令（如需要新 Rust 命令）
4. Python service 添加对应方法
5. 参数名称、类型、返回值结构三方一致

---

## 7. 数据库

### 7.1 表结构

11 张核心表：

| 表 | 说明 |
|----|------|
| `libraries` | 资料库配置 |
| `images` | 图片索引（含向量 ID、来源、元信息） |
| `excel_records` | Excel 记录（sheet、行、列、值） |
| `cad_files` | CAD/UG 文件信息 |
| `pdf_files` | PDF 文件信息 |
| `matches` | 图片 ↔ Excel/CAD/PDF 匹配关系 |
| `scan_history` | 扫描历史记录 |
| `change_logs` | 文件变更日志 |
| `settings` | key-value 设置存储 |
| `search_history` | 搜索历史 |
| `vectors` | FAISS 向量存储 |

### 7.2 连接管理

- WAL 模式：支持并发读写
- 线程本地连接：Python `threading.local()`
- 自动 schema 迁移：启动时检查并创建缺失的表

### 7.3 性能指标

| 操作 | 目标 |
|------|------|
| 打开数据库 | <5ms |
| 首页统计查询 | <10ms |
| 列表分页 (50条) | <20ms |
| 单条写入 | <5ms |

---

## 8. 构建与打包

### 8.1 开发环境

```bash
# 安装依赖
npm install
pip install -r requirements.txt

# 启动开发模式（热重载）
npm run tauri dev
```

### 8.2 代码检查

```bash
npm run check     # 全部 8 项检查
npm run lint      # ESLint（前端）
npm run lint:py   # mypy（Python 类型检查）
npm run build     # tsc --noEmit + vite build（类型检查 + 构建）
npm run test      # vitest（前端单元测试）
```

### 8.3 生产构建

```bash
# 一键发布构建
npm run build:release

# 或分步执行
npm run tauri build          # Tauri 构建 .msi
powershell scripts/build-msi.ps1  # MSI 后处理
```

产物路径：`src-tauri/target/release/bundle/msi/`

### 8.4 构建检查项 (npm run check)

| # | 检查项 | 命令 |
|---|--------|------|
| 1 | ESLint | `npx eslint .` |
| 2 | TypeScript | `npx tsc --noEmit` |
| 3 | Vite Build | `npx vite build` |
| 4 | Vitest | `npx vitest run` |
| 5 | Python mypy | `python -m mypy backend/` |
| 6 | Python pytest | `python -m pytest backend/` |
| 7 | 配置验证 | 验证 automation.config.json 格式 |
| 8 | 文档链接 | 验证文档内链接有效性 |

---

## 9. 测试

### 9.1 前端测试 (vitest)

```bash
npm run test
```

测试文件与源文件同目录，命名 `*.test.ts` / `*.test.tsx`。

### 9.2 后端测试 (pytest)

```bash
python -m pytest backend/
```

### 9.3 类型检查

```bash
npx tsc --noEmit          # TypeScript 类型检查
python -m mypy backend/   # Python 类型检查
```

### 9.4 端到端验证

```bash
# 扫描流程 e2e 测试
python backend/tests/test_e2e_scan.py

# 搜索质量 e2e 测试
python backend/tests/test_e2e_search.py
```

---

## 10. 调试

### 10.1 前端调试

- 开发模式下按 `F12` 打开 Chrome DevTools
- React 组件树：安装 React DevTools 扩展
- 网络请求：检查 Tauri IPC 调用在 DevTools Console

### 10.2 后端调试

- Python 后端日志输出到 stderr，在 Tauri 控制台可见
- 数据库文件位于用户数据目录（可通过设置页查看大小确认路径）
- 系统诊断页面检查所有组件状态

### 10.3 错误报告

严重错误时自动生成诊断 .zip 文件，包含：
- 系统信息（OS、Python 版本）
- 依赖状态
- 数据库完整性检查
- 最近日志

### 10.4 常见调试场景

**前端 IPC 调用无响应：**
1. 检查方法名是否与 Rust 命令注册一致
2. 检查 `tauri.conf.json` 权限配置
3. 检查 Python sidecar 是否正常运行

**Python 后端启动失败：**
1. 检查 `pip install -r requirements.txt` 输出
2. 运行系统诊断检查依赖
3. 查看 Tauri 控制台的 stderr 输出

**FAISS 搜索无结果：**
1. 确认 `images` 表中有 `vector_id` 不为空的记录
2. 确认向量维度为 512
3. 尝试"重建向量索引"后重新扫描

---

## 11. CI/CD

### 11.1 GitHub Actions

自动化工作流定义于 `.github/workflows/`：
- **CI**：push/PR 触发，运行 `npm run check` 全部 8 项
- **Build**：tag 触发，执行 `npm run build:release` 并上传产物

### 11.2 Pre-commit Hook

提交前自动运行：
- ESLint 检查
- TypeScript 类型检查
- 禁止提交包含 `TODO` / `FIXME` 未处理的代码（可选规则）
