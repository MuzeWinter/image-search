# ZOOBET 智能检索 (ZOOBET Image Search)

基于 AI 视觉的本地图纸搜索引擎，专为产品设计师打造。

拖入一张参考图片，秒级在本机历史资料库中找到最相似的图纸、Excel 内嵌图、UG 预览图，
并自动关联来源文件与编号。全程本地运行，数据零外传。

## 核心功能

### 搜索
- **AI 以图搜图**：OpenCLIP ViT-B/32 视觉模型提取特征，FAISS 毫秒级向量检索
- **多种输入方式**：拖拽图片、Ctrl+V 粘贴、点击浏览、命令行参数
- **智能过滤**：按来源类型（Excel/UG/文件图片）、资料库、收藏状态筛选
- **相似度阈值**：滑块调节 0-100%，低于阈值的结果自动隐藏
- **结果排序**：相似度降序 / 文件名升序 / UG 图号升序
- **网格/列表视图**：一键切换，缩略图尺寸三档可调
- **文本二次过滤**：按文件名、UG 图号、OCR 文字、sheet 名过滤
- **图片对比**：选中 2 张结果，分屏对比，同步缩放、拖拽平移
- **搜索历史**：最近 20 条，含缩略图，点击重搜
- **导出与分享**：ZIP 打包、PDF 报告、复制到剪贴板、在文件管理器中打开

### 资料库
- **多资料库管理**：添加文件夹路径或拖拽文件夹加入
- **7 阶段扫描管线**：收集 → 哈希 → 比对 → 移动检测 → 保存 → Excel 提取 → UG 预览 → 关联 → 索引
- **增量扫描**：自动检测新增/修改/移除/移动四种变更
- **实时进度**：进度条 + 阶段名称 + 文件计数 + 预估剩余时间
- **文件夹监控**：启用后自动监听资料库变更并触发增量扫描
- **软删除 + 撤销**：删除资料库后 5 秒内可撤销
- **启动验证**：自动检查资料库路径有效性

### 设置
- **主题**：浅色 / 深色 / 跟随系统
- **语言**：中文 / 英文，自动检测系统语言
- **强调色**：5 种预设色
- **相似度阈值**、**扫描扩展名**、**OCR 开关**、**UG 预览开关**
- **数据库维护**：备份 / 恢复 / 优化 / 重建索引 / 清除缓存
- **系统诊断**：Python 版本、pip 依赖、DB 完整性、磁盘空间、FAISS 索引
- **活动日志**：按级别过滤查看
- **恢复默认设置**

### 系统
- **Tauri v2 桌面框架**：Rust 原生窗口，启动 <150ms 可交互
- **自定义标题栏**：无原生装饰，窗口拖拽、最小化/最大化/关闭
- **窗口状态记忆**：位置、尺寸、最大化状态持久化
- **系统托盘**：最小化到托盘，双击恢复
- **CLI 参数**：`--scan <path>` 自动扫描，`--search <path>` 自动搜索
- **退出自动备份**：保留最近 5 份数据库备份

### UX
- **首次启动向导**：4 步引导
- **键盘快捷键**：Ctrl+1/2/3 切换页面、Ctrl+V 粘贴搜索、Ctrl+Shift+F 全局搜索、Ctrl+/ 快捷键帮助
- **Toast 通知**：成功/错误/警告/信息 4 种类型
- **骨架屏加载**、**悬停预览**、**懒加载缩略图**、**焦点可见轮廓**
- **虚拟滚动**：大结果集流畅渲染

完整功能清单见 [docs/FEATURES.md](docs/FEATURES.md)。

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Tauri v2 (Rust) |
| 前端 | React 18 + TypeScript + Vite + Jotai |
| AI 模型 | OpenCLIP ViT-B/32 |
| 向量搜索 | FAISS |
| 后端 | Python 3 JSON-RPC (sidecar) |
| 数据库 | SQLite (WAL 模式) |
| UG 提取 | NXOpen API (可选) |
| OCR | EasyOCR |

## 快速开始

### 前置要求

- **Node.js** 18+
- **Rust** (MSVC toolchain) — 安装 [rustup](https://rustup.rs/)
- **Python** 3.9+ (推荐 3.11)
- **[可选] Siemens NX** — 用于 .prt 文件预览图提取

### 安装依赖

```bash
# 前端依赖
npm install

# Python 后端依赖
pip install -r requirements.txt
```

### 开发模式

```bash
npm run tauri dev
```

首次启动会自动下载 Tauri 依赖并编译 Rust 后端。

### 生产构建

```bash
# 生成 .msi 安装包
npm run build:release
```

产物在 `src-tauri/target/release/bundle/` 目录。

## 项目结构

```
Image Search/
├── src/                    # React 前端
│   ├── pages/              # Search / Library / Settings
│   ├── components/         # shell (Sidebar/Header) + shared (Toast/WelcomeGuide)
│   ├── services/           # 前端服务层 (IPC 调用后端)
│   ├── contexts/           # Theme / I18n / Toast
│   ├── i18n/               # zh.json / en.json
│   └── styles/             # CSS (design-system/shell/search/toast/welcome)
├── src-tauri/              # Tauri Rust 后端
│   ├── src/main.rs         # Rust 命令 (call_backend/scan_library/open_file/...)
│   └── capabilities/       # 权限配置
├── backend/                # Python 后端
│   ├── main.py             # JSON-RPC 入口
│   ├── services/           # ai/search/scan/excel/ug/library/db/settings
│   └── db/                 # SQLite 连接
├── scripts/                # 自动化脚本
│   ├── claude-codex-loop.ps1   # Codex+Claude 自动化循环
│   ├── codex-review-check.ps1  # 代码审查
│   └── build-msi.ps1           # MSI 打包
└── docs/                   # 文档
    ├── USER-GUIDE.md       # 使用指南
    ├── DEV-GUIDE.md        # 开发指南
    ├── CHANGELOG.md        # 版本记录
    ├── DESIGN-PLAN.md      # 设计规划
    └── FEATURES.md         # 功能清单
```

## 文档

| 文档 | 说明 |
|------|------|
| [docs/USER-GUIDE.md](docs/USER-GUIDE.md) | 用户使用指南 — 搜索、资料库、设置、导出 |
| [docs/DEV-GUIDE.md](docs/DEV-GUIDE.md) | 开发指南 — 架构、技术栈、构建、调试 |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | 版本变更记录 |
| [docs/FEATURES.md](docs/FEATURES.md) | 完整功能清单 (110 项) |
| [docs/DESIGN-PLAN.md](docs/DESIGN-PLAN.md) | 设计规划文档 |

## 自动化流水线

项目使用 Codex + Claude Code 双 Agent 自动化：

```bash
# 单次执行队列中的任务
powershell -ExecutionPolicy Bypass -File scripts/claude-codex-loop.ps1 -Once

# 持续循环
powershell -ExecutionPolicy Bypass -File scripts/claude-codex-loop.ps1
```

任务队列：`docs/claude-tasks/queue/`  
已完成：`docs/claude-tasks/done/`

## 质量保证

```bash
npm run check    # 全部 8 项检查：ESLint + tsc + vitest + mypy + pytest + 配置验证 + 产物验证 + 文档链接
npm run test     # 前端单元测试 (vitest)
npm run lint     # ESLint 代码检查
npm run lint:py  # Python mypy 类型检查
```

## 规则文档

- `AGENTS.md` — Codex 规则
- `CLAUDE.md` — Claude Code 规则
- `docs/AI-CODING-RULES.md` — 详细编码规范
