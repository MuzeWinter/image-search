# Claude Code 任务单：007 — 清理 .gitignore + 移除 __pycache__ + 优化 Vite 代码分割

## 角色

遵守项目全部规则文件。只改指定内容。

## 本次目标

修复三个工程化问题。

## 必须实现

### 1. .gitignore 补全
- 添加 `__pycache__/` 和 `*.pyc` 到 .gitignore
- 用 `git rm --cached` 移除已追踪的 __pycache__ 文件
- 确保 `dist/`、`node_modules/`、`src-tauri/target/` 已在 ignore 列表中

### 2. Vite 代码分割优化
- 在 `vite.config.ts` 的 `manualChunks` 中添加：
  - `react-router-dom` → `vendor-router` chunk
  - `@tauri-apps/api` → `vendor-tauri` chunk  
  - `jotai` → `vendor-jotai` chunk
- 目标：home chunk 从 185KB 降到 <30KB

### 3. 添加 shared chunks
- 将 `src/components/shared/` 下的 Skeleton、EmptyState、InlineError 等放入 `chunk-shared` 

## 建议修改文件
- `.gitignore`
- `vite.config.ts`
- 执行 `git rm --cached` 移除 __pycache__

## 禁止事项
- 不许改页面功能
- 不许删文件（除了 __pycache__）
- 不许 git commit/push

## 验收标准
- `npm run build` 通过
- home chunk < 50KB
- git status 不再显示 __pycache__ 
