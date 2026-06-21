# Claude Code 任务单：v2-35 — 批量操作：多选搜索结果

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索结果支持多选（Ctrl+点击），批量打开/导出选中项。

## 必须实现

### 1. 多选逻辑 (Search.tsx)
- Ctrl+点击切换选中状态
- 选中项显示高亮边框
- 顶部工具栏显示选中数量 + 批量操作按钮

### 2. 批量操作
- 批量打开文件所在文件夹
- 批量导出选中为 CSV
- 批量复制路径

### 3. 验收标准
- `npm run build` 零错误
- 多选功能正常
- 深色/浅色主题下选中高亮清晰

## 不执行 git commit/push
