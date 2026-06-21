# Claude Code 任务单：v2-03 — 删除 10 个废弃页面+7 个服务

遵守全部规则文件。

## 目标
删除多页面项目中不再需要的文件。

## 删除清单
页面 (10个): CadFiles, ExcelRecords, PdfFiles, Tags, Favorites, MatchManagement, Changelog, ScanReport, ImageLibrary, Home

服务 (7个): cadService, excelService, pdfService, tagService, matchService, aiService, ocrService

后端服务: 删除 backend/services/ 下 cad/pdf/tag/match 相关文件（如有），excel_service.py 保留但后续改。

## 必须实现
1. 删除上述文件
2. `npm run build` 零错误

## 不执行 git commit/push
