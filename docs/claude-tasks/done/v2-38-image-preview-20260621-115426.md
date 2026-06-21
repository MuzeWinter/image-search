# Claude Code 任务单：v2-38 — 搜索结果图片放大预览

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索结果缩略图鼠标悬停时显示放大预览。

## 必须实现

### 1. 悬停预览 (Search.tsx)
- 鼠标悬停缩略图 300ms 后显示放大预览浮层
- 预览尺寸：原图等比缩放，最大 400x400
- 预览位置：智能定位（不超出屏幕）
- 鼠标移出关闭

### 2. 验收标准
- `npm run build` 零错误
- 深色/浅色主题适配
- 不影响搜索性能

## 不执行 git commit/push
