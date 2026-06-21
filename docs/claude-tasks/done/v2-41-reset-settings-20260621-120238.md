# Claude Code 任务单：v2-41 — 重置所有设置为默认值

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
设置页增加"恢复默认设置"按钮，一键重置所有配置。

## 必须实现

### 1. 重置功能 (Settings.tsx)
- "恢复默认设置"按钮（红色警告样式）
- 确认对话框：列出将被重置的项
- 重置项：主题、语言、UG列名、扩展名配置、localStorage 缓存
- 重置后页面立即刷新

### 2. 验收标准
- `npm run build` 零错误
- 重置后所有配置恢复默认
- 确认对话框清晰列出影响范围
- 深色/浅色主题适配

## 不执行 git commit/push
