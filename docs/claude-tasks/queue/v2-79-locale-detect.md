# Claude Code 任务单：v2-79 — 语言自动检测

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
首次启动时根据系统语言自动设置应用语言。中文系统→zh，否则→en。

## 必须实现
- 检测 `navigator.language`
- 仅首次启动时生效（localStorage 无 locale 记录时）
- 后续遵循用户手动设置

## 验收标准
- `npm run build` 零错误
- 英文系统首次启动显示英文

## 不执行 git commit/push
