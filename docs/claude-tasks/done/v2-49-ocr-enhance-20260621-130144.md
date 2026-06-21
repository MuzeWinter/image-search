# Claude Code 任务单：v2-49 — OCR 文字提取增强搜索

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
利用已有 ocr_service.py，在搜索结果中显示图片的 OCR 文字（如果有），支持文字关键词二次过滤。

## 必须实现
- 后端 ocr_service 已有 PaddleOCR 集成，确认可用
- 扫描时对 Excel 内嵌图片自动 OCR
- 搜索结果显示 OCR 文字摘要（前 50 字符）
- 前端文字过滤框同时搜索 OCR 结果

## 验收标准
- `npm run build` 零错误
- OCR 结果在搜索结果中显示
- 无 OCR 服务时不崩溃

## 不执行 git commit/push
