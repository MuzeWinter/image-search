# Claude Code 任务单：v2-71 — 全局快捷键 Ctrl+Shift+F 全局搜索框

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
任意页面按 Ctrl+Shift+F 弹出全局搜索悬浮框，快速搜索文件名/UG编号。

## 必须实现
- 全局快捷键 Ctrl+Shift+F
- 弹出搜索框（模态浮层）
- 输入时实时搜索 images 表（文件名/UG编号）
- 搜索结果可直接打开文件

## 验收标准
- `npm run build` 零错误
- 搜索响应 <200ms

## 不执行 git commit/push
