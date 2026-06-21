# Claude Code 任务单：v2-64 — 加载动画统一优化

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
统一全应用加载状态：资料库列表加载、搜索结果加载、设置保存加载，使用一致的脉冲动画。

## 必须实现
- 所有 Skeleton 使用统一的 CSS 动画
- 按钮 loading 状态统一旋转图标
- 色值使用 CSS 变量确保主题一致

## 验收标准
- `npm run build` 零错误
- 所有加载状态动画流畅一致

## 不执行 git commit/push
