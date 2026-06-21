# ZOOBET检索

本地智能文件管理与检索工具，支持图像、PDF、CAD 图纸、Excel 表格的扫描、索引和搜索。

## 技术栈

- **前端**: React 18 + TypeScript + Vite + Jotai
- **桌面**: Tauri 2 (Rust)
- **后端**: Python (FastAPI / 本地服务)
- **数据库**: SQLite

## 快速开始

```bash
npm install
npm run tauri dev
```

## 项目结构

```
src/                    # 前端 React 源码
  components/           # UI 组件 (shell, shared)
  pages/                # 页面组件
  services/             # 业务服务层 (API 调用、数据存储)
  stores/               # Jotai 状态管理
  i18n/                 # 多语言 (中文/英文)
  contexts/             # React Context (主题等)
src-tauri/              # Tauri 桌面壳 (Rust)
backend/                # Python 后端服务
  db/                   # 数据库连接
  services/             # 业务逻辑服务
  scripts/              # 工具脚本
test-data/              # 本地测试数据 (不提交)
```

## 许可

MIT
