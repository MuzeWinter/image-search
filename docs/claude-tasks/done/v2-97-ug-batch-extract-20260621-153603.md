# Claude Code 任务单：v2-97 — UG NXOpen 批量提取优化

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
优化 UG NXOpen .prt 文件预览图批量提取，支持大规模图纸目录（10 年级别）快速处理。

## 必须实现
1. 在 `backend/services/ug_service.py` 增加批量提取接口，支持目录递归扫描
2. 添加提取进度回调/状态上报
3. 处理 NXOpen 不可用时的优雅降级（回退到文件元信息）
4. 缓存已提取的预览图，避免重复提取
5. 支持断点续扫（记录上次扫描位置）
6. 提取超时保护（单个文件最长 60 秒）

## 不破坏
- 现有搜索/索引功能
- 现有 CLI/API 接口兼容
- npm run check 全部 8 项 PASS

## 验收标准
- UG 服务批量提取接口可用
- 无 NXOpen 环境时优雅降级不崩溃
- npm run check 全部 PASS
- 不执行 git commit/push