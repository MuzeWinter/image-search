# ZOOBET 智能检索 (ZOOBET Image Search)

基于 AI 视觉的本地图纸搜索引擎，专为产品设计师打造。

## 功能

- **图片相似搜索**：拖入参考图片，通过 CLIP 视觉模型查找资料库中最相似的图纸/图片
- **UG 图纸支持**：自动扫描 `.prt` 文件，通过 NXOpen 提取预览图并索引
- **Excel 账单图片**：自动提取 Excel 表格中嵌入的图片，支持 UG 编号关联
- **本地 AI**：所有处理在本地完成，数据不外泄
- **深色/浅色主题**：完整支持双主题切换
- **中英文双语**：完整 i18n 支持

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Tauri v2 (Rust) |
| 前端 | React 18 + TypeScript + Vite + Jotai |
| AI 模型 | OpenCLIP ViT-B/32 |
| 向量搜索 | FAISS |
| 后端 | Python 3 JSON-RPC |
| 数据库 | SQLite |
| UG 提取 | NXOpen API (可选) |

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
└── docs/                   # 文档 (Superpowers spec/plan, Claude任务队列)
```

## 快速开始

### 前置要求
- Node.js 18+
- Rust (MSVC toolchain)
- Python 3.9+ (推荐 3.11)
- [可选] Siemens NX (用于 .prt 预览提取)

### 安装依赖

```bash
# 前端
npm install

# Python 后端
pip install -r requirements.txt
```

### 开发模式

```bash
npm run tauri dev
```

### 生产构建

```bash
npm run tauri build
```

### MSI 打包

```bash
powershell -ExecutionPolicy Bypass -File scripts/build-msi.ps1
```

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

## 规则文档

- `AGENTS.md` — 项目最高规则
- `CLAUDE.md` — 核心规则
- `docs/AI-CODING-RULES.md` — 详细编码规范
