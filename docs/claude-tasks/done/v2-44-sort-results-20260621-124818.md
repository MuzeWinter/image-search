# Claude Code 任务单：v2-44 — 搜索结果排序切换

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索结果支持切换排序方式：相似度降序 / 文件名升序 / UG编号升序。

## 必须实现
- Search.tsx 结果区域增加排序下拉框
- 选项：相似度（默认）、文件名 A-Z、UG 编号 A-Z
- 前端排序，不改变后端查询

## 验收标准
- `npm run build` 零错误

## 不执行 git commit/push
