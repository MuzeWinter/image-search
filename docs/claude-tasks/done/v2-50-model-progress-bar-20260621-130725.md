# Claude Code 任务单：v2-50 — 首次索引进度持久化显示

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索页在 AI 模型未就绪时显示进度条+状态文字，替代纯文字"加载中"。

## 必须实现
- Search.tsx 的 model-loading 状态增加动画进度条
- 进度条宽度绑定 modelPercent
- 状态文字显示 modelMsg
- 深色/浅色主题适配

## 验收标准
- `npm run build` 零错误

## 不执行 git commit/push
