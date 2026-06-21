# Claude Code 任务单：v2-45 — 搜索结果网格/列表视图切换

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索结果支持网格视图（缩略图网格）和列表视图（详细信息行）切换。

## 必须实现
- 结果区顶部增加网格/列表切换按钮
- 网格：缩略图卡片，2-4列自适应
- 列表：单列详细信息（文件名、路径、相似度、UG编号）
- localStorage 记住用户偏好

## 验收标准
- `npm run build` 零错误
- 深色/浅色主题适配

## 不执行 git commit/push
