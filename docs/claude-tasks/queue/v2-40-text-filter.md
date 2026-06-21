# Claude Code 任务单：v2-40 — 文件名全文搜索

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索页增加文字搜索框，输入 UG 编号或文件名关键词快速过滤结果。

## 必须实现

### 1. 文字搜索 (Search.tsx)
- 图片搜索完成后显示搜索框
- 输入关键词实时过滤结果（前端过滤）
- 匹配：img_id、origin_path、ug_ref、sheet_name

### 2. 验收标准
- `npm run build` 零错误
- 搜索结果可被关键词过滤
- 无匹配时显示"无匹配结果"

## 不执行 git commit/push
