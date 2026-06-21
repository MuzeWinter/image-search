# Claude Code 任务单：v2-76 — 图片元信息显示

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索结果详情中显示图片元信息：分辨率、文件大小、格式。

## 必须实现
- 后端返回图片元信息（width, height, file_size, format）
- 前端结果显示：如 "1920×1080 · PNG · 245KB"
- Search.tsx 结果卡片中显示

## 验收标准
- `npm run build` 零错误

## 不执行 git commit/push
