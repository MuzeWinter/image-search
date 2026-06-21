# Claude Code 任务单：v2-113 — 批量操作增强

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
增强搜索结果批量操作能力，支持批量删除/导出/标记。

## 必须实现
1. 搜索结果批量选择后统一操作工具栏
2. 批量删除选中结果（含确认对话框）
3. 批量导出选中结果为 ZIP
4. 批量标记为收藏/取消收藏
5. 全选/取消全选功能

## 不破坏
- 现有单结果操作
- npm run check 全部 8 项 PASS

## 验收标准
- 批量选择/删除/导出/标记均可使用
- npm run check 全部 PASS
- 不执行 git commit/push