# Claude Code 任务单：v2-114 — 智能搜索结果排序

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
增强搜索结果排序能力，支持多维度排序切换。

## 必须实现
1. 排序方式切换：相似度/文件名/日期/文件大小
2. 升序/降序切换
3. 排序状态记忆（下次搜索保持上次排序方式）
4. 排序指示器 UI（当前排序字段高亮+箭头）

## 不破坏
- 现有搜索默认相似度排序
- npm run check 全部 8 项 PASS

## 验收标准
- 四种排序方式均可切换
- 排序状态跨搜索保持
- npm run check 全部 PASS
- 不执行 git commit/push