# Claude Code 任务单：010 — 清理死文件 + Error Boundary + TS 类型完善

## 角色

遵守项目全部规则文件。

## 本次目标

项目整洁化 + 前端工程完善。

## 必须实现

### 1. 清理死文件
以下文件已不再使用，移动到 `docs/archive/` 目录保留为参考：
- `js/app.js` → `docs/archive/prototype/app.js`
- `提示词.txt` → `docs/archive/prototype/提示词.txt`
- `index.html` → `docs/archive/prototype/index.html`
- `css/design-system.css` → `docs/archive/prototype/design-system.css`
- 所有 `0*-*.html` 原型页面 → `docs/archive/prototype/pages/`

### 2. React Error Boundary
- 创建 `src/components/shared/ErrorBoundary.tsx`
- 包裹 `<Routes>` 和每个 `<Suspense>` 
- 显示友好错误页面（不是白屏）+ 重试按钮
- 中英文错误信息

### 3. TypeScript 完善
- 检查并移除所有 `: any` 类型标注
- 为 `useServiceQuery` 添加完整泛型约束
- 为 IPC invoke 返回值添加类型守卫

### 4. 清理原型遗留引用
- 确保没有任何代码引用 `js/app.js`
- 确保 `index.html` 不再被任何构建步骤使用

## 建议修改文件
- 移动上述文件
- 新建 `src/components/shared/ErrorBoundary.tsx`
- 修改 `src/App.tsx`
- 修改 `src/stores/hooks.ts`
- 检查是否有 TS `any` 类型

## 禁止事项
- 不许删除文件（只能移动到 archive）
- 不许破坏功能
- 不许 git commit/push

## 验收标准
- `npm run build` 零错误
- `npm run build` 零 `any` 类型警告
- 根目录清洁（只保留 src/ backend/ docs/ scripts/ package.json 等核心文件）
