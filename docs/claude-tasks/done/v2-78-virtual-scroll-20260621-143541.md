# Claude Code 任务单：v2-78 — 大量结果虚拟滚动优化

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索结果超过 200 条时使用虚拟滚动，只渲染可视区域内的 DOM 节点。

## 必须实现
- 安装 react-window 或自实现虚拟列表
- 列表/网格视图均支持
- 保留懒加载缩略图机制

## 验收标准
- `npm run build` 零错误
- 500+ 结果时滚动流畅

## 不执行 git commit/push
