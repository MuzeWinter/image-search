# Claude Code 任务单：Phase 1 — 即时启动 Shell

## 角色

你是本项目的代码实现 Agent，只负责写代码。必须严格遵守项目规则文件。
禁止假功能、禁止只做 UI、禁止吞错误、禁止删除原有功能。

## 本次目标

从零搭建 Tauri v2 + React + TypeScript 项目，实现即时启动 Shell：
用户双击 exe 后 **150ms 内**看到完整界面（侧边栏 + 顶部栏 + 状态栏 + 首页导航卡片）。
Shell 渲染不依赖任何后端数据。所有页面通过 React.lazy 按需加载。

## 当前已有基础

- `docs/DESIGN-PLAN.md`：v2.0 完整设计规划文档（架构/模块/接口/路线图）
- `css/design-system.css`：设计系统 CSS 变量（主题色/字体/间距/圆角）
- `js/app.js`：Mock 数据结构参考
- `index.html` 及 12 个原型页面：UI 布局参考
- `automation.config.json`：验收命令配置
- `AGENTS.md` / `CLAUDE.md`：项目编程规范

## 必须实现

### 1. Tauri v2 项目初始化

- 使用 `npm create tauri-app@latest` 初始化项目
- 框架选择 React + TypeScript，构建工具 Vite
- 配置 `tauri.conf.json`：无标题栏（`decorations: false`）、窗口尺寸 1280×800、最小 1024×680
- 配置 Vite 代码分割（manualChunks 按页面拆分）

### 2. AppShell 主布局（主 bundle，不懒加载）

- `AppShell.tsx`：左侧 Sidebar(260px) + 顶部 Header(56px) + 内容区 + 底部 StatusBar(30px)
- `Sidebar.tsx`：品牌名 + 12 个导航链接（分组：检索/浏览/管理/分类/系统）+ 版本号
- `Header.tsx`：窗口拖拽区 + 窗口控制按钮（最小化/最大化/关闭）+ 搜索入口
- `WindowControls.tsx`：三个按钮绑定 Tauri 窗口 API，真实可用
- `StatusBar.tsx`：显示资料库数量、索引图片数、后台任务状态

### 3. 12 个页面占位（React.lazy）

每个页面作为独立 Vite chunk：
- `Home.tsx`：欢迎 Banner + 统计数字（骨架屏占位）+ 功能导航卡片
- `Search.tsx` ~ `Changelog.tsx`：页面标题 + 骨架屏占位内容
- 路由使用 `React.lazy(() => import("./pages/..."))` + `<Suspense>`

### 4. 设计系统迁移

- 将 `css/design-system.css` 的 CSS 变量完整迁移到 React 项目
- 深色主题通过 `[data-theme="dark"]` 选择器覆盖变量
- 字体、字号、间距、圆角、边框变量全部保留

### 5. 主题切换

- 浅色（默认）/ 深色 / 跟随系统三种模式
- 切换即时生效（修改 `<html data-theme>` 属性）
- 使用 localStorage 保存偏好，启动时恢复
- ThemeToggle 组件放在 Header 右侧

### 6. 中英文切换

- i18n 使用轻量方案（React Context + JSON）
- `zh.json` / `en.json`：Sidebar 导航文字、窗口按钮提示、状态栏文字、首页文字
- 语言切换即时生效
- localStorage 保存偏好，启动时恢复

### 7. 窗口控制

- 无标题栏（`decorations: false`）
- Header 区域可拖拽窗口（`data-tauri-drag-region`）
- 最小化/最大化/还原/关闭按钮真实调用 Tauri API
- 双击 Header 最大化/还原
- 窗口边缘可拖拽缩放

### 8. Skeleton 骨架屏组件

- `Skeleton.tsx`：通用骨架屏组件（支持文本行/卡片/图片占位）
- 脉冲动画（CSS animation）
- 深色/浅色主题适配

### 9. 错误处理组件

- `InlineError.tsx`：内联错误提示（非模态，带重试按钮）
- `EmptyState.tsx`：空状态引导（图标 + 文字 + 操作按钮）

## 禁止事项

- 不许用 mock 冒充真实结果（骨架屏可以，假数据不行）
- 不许只显示成功但不执行真实业务
- 不许删除现有原型文件（`*.html`、`css/`、`js/`）
- 不许泄露密钥或令牌
- 不许执行 git commit
- 不许执行 git push
- 不许引入 UI 组件库（保持零依赖）

## 建议修改文件

```
src/main.tsx                    # 新建：React 入口
src/AppShell.tsx                # 新建：主布局
src/components/shell/
  Sidebar.tsx                   # 新建
  Header.tsx                    # 新建
  StatusBar.tsx                 # 新建
  WindowControls.tsx            # 新建
src/components/shared/
  Skeleton.tsx                  # 新建
  InlineError.tsx               # 新建
  EmptyState.tsx                # 新建
  ThemeToggle.tsx               # 新建
  LocaleToggle.tsx              # 新建
src/pages/Home.tsx              # 新建（12个页面）
src/i18n/zh.json                # 新建
src/i18n/en.json                # 新建
src/i18n/context.tsx            # 新建
src/styles/design-system.css    # 从原型迁移
src/styles/shell.css            # 新建
src/styles/skeleton.css         # 新建
src/styles/dark-theme.css       # 新建
src-tauri/tauri.conf.json       # 修改：无标题栏配置
src-tauri/Cargo.toml            # 修改：添加窗口控制依赖
src-tauri/src/main.rs           # 修改：窗口管理
```

## 不要修改

- `*.html`（原型文件保留）
- `css/design-system.css`（原文件保留不移走，复制一份到 src/）
- `js/app.js`（保留）
- `docs/` 目录下的文档
- `AGENTS.md`、`CLAUDE.md`、`automation.config.json`

## 必须运行

```bash
npm run build      # TypeScript 编译 + Vite 构建通过
cargo build        # Tauri Rust 层编译通过（在 src-tauri 目录）
```

## 验收标准

- 双击编译产物，窗口在 150ms 内完整可见
- Sidebar 12 个导航链接可点击，点击后内容区切换对应页面
- 窗口控制按钮真实可用（最小化/最大化/关闭）
- 深色/浅色主题切换即时生效，全界面同步
- 中/英文切换即时生效，导航文字和提示同步切换
- 关闭重新打开，主题和语言偏好保留
- 原型文件未被删除或破坏
- TypeScript 编译零错误
- Vite 构建通过，代码分割生效（每个页面独立 chunk）

## 完成后回报

- 修改文件列表
- 页面渲染流程（从入口到 Shell 到各页面）
- 成功和失败时用户看到的内容
- 构建命令与结果
- 风险或未完成项
