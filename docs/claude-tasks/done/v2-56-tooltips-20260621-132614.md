# Claude Code 任务单：v2-56 — 按钮提示工具 (Tooltip)

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
为所有无文字标签的按钮添加悬浮 Tooltip，hover 300ms 后显示。

## 必须实现
- 创建 `src/components/shared/Tooltip.tsx`
- 页面切换按钮、操作按钮、窗口控制按钮使用 Tooltip
- Tooltip 在深色/浅色主题可见
- 位置智能（不溢出屏幕）

## 验收标准
- `npm run build` 零错误

## 不执行 git commit/push
