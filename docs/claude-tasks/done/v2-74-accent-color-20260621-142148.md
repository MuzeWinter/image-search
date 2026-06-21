# Claude Code 任务单：v2-74 — 自定义主题强调色选择器

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
设置页增加主题强调色选择（蓝/绿/紫/橙/红），用户自定义 `--accent` 变量值。

## 必须实现
- 5 个预设色块按钮
- 点击立即生效
- 保存到 localStorage
- 重启后恢复

## 验收标准
- `npm run build` 零错误
- 所有使用 `var(--accent)` 的元素跟随变化

## 不执行 git commit/push
