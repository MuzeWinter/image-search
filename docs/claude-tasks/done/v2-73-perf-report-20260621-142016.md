# Claude Code 任务单：v2-73 — 最终性能审计报告

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
生成项目性能审计报告：构建产物大小、各chunk体积、CSS文件数、图片资源。

## 必须实现
- 分析 dist/ 产物：各文件大小、gzip 大小
- 统计组件数量、hooks数量、服务数量
- 输出报告到 `docs/performance-report.md`

## 验收标准
- 报告文件生成
- 构建产物总大小合理 (<2MB gzip)

## 不执行 git commit/push
