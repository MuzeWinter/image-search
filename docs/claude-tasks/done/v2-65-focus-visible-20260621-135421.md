# Claude Code 任务单：v2-65 — 焦点可见性 (无障碍增强)

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
所有可交互元素增加键盘焦点可见样式（focus-visible 环形高亮）。

## 必须实现
- CSS 全局 `:focus-visible` 样式
- 按钮、链接、输入框焦点边框
- 深色/浅色主题下高亮颜色不同

## 验收标准
- `npm run build` 零错误
- Tab 键可遍历所有按钮

## 不执行 git commit/push
