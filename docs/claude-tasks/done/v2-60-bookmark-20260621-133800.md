# Claude Code 任务单：v2-60 — 搜索结果项标记/收藏

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索结果项支持标记（星标），标记项保存在 localStorage，支持在搜索页查看已标记项。

## 必须实现
- 每个结果项右上角星标图标，点击切换
- localStorage 存储标记的 img_id 列表
- 搜索范围增加"已标记"过滤选项
- 标记状态在重新搜索后保留

## 验收标准
- `npm run build` 零错误

## 不执行 git commit/push
