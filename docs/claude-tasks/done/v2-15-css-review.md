# Claude Code 任务单：v2-15 — 样式审查与优化

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
审查 CSS 文件，确保深色/浅色主题在所有组件中完整适配，无硬编码颜色。

## 任务

### 1. shell.css 审查
- 检查 `src/styles/shell.css` 是否所有颜色使用 CSS 变量
- Sidebar/Header/StatusBar 在深色/浅色下是否都可用
- 确保 `.theme-dark` 或 `[data-theme="dark"]` 覆盖规则完整

### 2. search.css 审查
- 检查搜索页面所有元素（drop zone, result cards, badges, buttons）
- Image display area 深色模式适配
- Similarity badge 颜色在两种主题下都可读

### 3. design-system.css 审查
- 确认 `:root` 和 `[data-theme="dark"]` 都定义了完整的变量集
- 检查 scrollbar 样式是否跟随主题
- 输入框、下拉框 focus/disabled/hover 状态

### 4. toast.css 和 welcome.css 审查
- 确认 toast 四种类型在深色模式下都可读
- 确认 welcome dialog 背景/文字对比度

## 验收标准
- 搜索 CSS 中硬编码颜色（如 `#fff`, `#1a1a1a`, `#666`），改用 CSS 变量
- `npm run build` 零错误
- 不破坏任何原有布局

## 不执行 git commit/push
