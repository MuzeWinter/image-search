# Claude Code 任务单：v2-48 — 图片相似度颜色标记优化

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
相似度标记增加颜色渐变：>80% 绿色、50-80% 橙色、<50% 灰色，网格视图卡片边框用相似度颜色。

## 必须实现
- 3 级颜色：high(绿)、mid(橙)、low(灰) 
- 网格视图卡片左边框用相似度颜色
- 列表视图相似度 badge 背景色渐变
- 深色主题下调亮色值确保可读

## 验收标准
- `npm run build` 零错误

## 不执行 git commit/push
