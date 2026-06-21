# Claude Code 任务单：v2-72 — 快捷键帮助弹窗

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
按 `Ctrl+/` 或 `?` 弹出快捷键参考面板，列出所有可用快捷键。

## 必须实现
- 全局监听 `Ctrl+/` 和 `?`
- 弹窗列出所有快捷键：Ctrl+1/2/3, Ctrl+V, Ctrl+/, Ctrl+Shift+F, Escape
- 深色/浅色主题适配
- 点击外部或按 Esc 关闭

## 验收标准
- `npm run build` 零错误

## 不执行 git commit/push
