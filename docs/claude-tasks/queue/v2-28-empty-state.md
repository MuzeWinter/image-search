# Claude Code 任务单：v2-28 — 空状态插图优化

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
优化三个页面的空状态展示，用 SVG 图标替代 emoji，提升专业感。

## 必须实现

### 1. 空状态 SVG 图标
- Search 空状态：搜索图标 SVG
- Library 空状态：文件夹图标 SVG
- 使用 `src/components/shared/EmptyState.tsx` 统一组件

### 2. 统一 EmptyState 组件
- 接受 icon (ReactNode)、title、description
- 深色/浅色主题下颜色使用 CSS 变量
- 替换 Search.tsx 和 Library.tsx 中内联的空状态

### 3. 验收标准
- `npm run build` 零错误
- 空状态图标在深色/浅色主题下清晰
- 不影响现有空状态文字

## 不执行 git commit/push
