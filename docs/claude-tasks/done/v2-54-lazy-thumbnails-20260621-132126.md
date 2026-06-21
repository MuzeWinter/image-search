# Claude Code 任务单：v2-54 — 搜索结果缩略图懒加载

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索结果使用 Intersection Observer 懒加载缩略图，大幅结果集时减少初始渲染开销。

## 必须实现
- 创建 `useIntersectionObserver` hook
- 缩略图仅在进入视口时加载
- 加载前显示骨架占位
- 不破坏现有 `loading="lazy"` 机制

## 验收标准
- `npm run build` 零错误
- 快速滚动时缩略图按需加载

## 不执行 git commit/push
