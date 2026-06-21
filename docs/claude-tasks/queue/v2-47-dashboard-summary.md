# Claude Code 任务单：v2-47 — 活动摘要仪表盘

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索页顶部增加活动摘要卡片：资料库数、已索引图片数、最近扫描时间。

## 必须实现
- Search.tsx 顶部 summary 卡片行
- 3 个指标：资料库 / 已索引 / 最近扫描
- 从后端 db.getStats 获取数据
- 卡片样式：圆角、阴影、hover 微动效

## 验收标准
- `npm run build` 零错误
- 深色/浅色主题适配
- 数据 0 时显示 "—"

## 不执行 git commit/push
