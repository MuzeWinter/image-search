# Claude Code 任务单：v2-27 — 导出搜索结果 CSV

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索结果支持导出为 CSV 文件，包含图片编号、来源类型、相似度、文件路径、UG 编号等信息。

## 必须实现

### 1. 导出按钮 (Search.tsx)
- 有结果时显示"导出"按钮
- 点击弹出保存对话框
- 使用 @tauri-apps/plugin-dialog save

### 2. CSV 格式
列：排名, 图片ID, 来源类型, 相似度, 文件路径, UG编号, 工作表, 行号
编码：UTF-8 BOM (Excel 兼容)

### 3. 验收标准
- `npm run build` 零错误
- 导出 CSV 用 Excel 可正确打开（中文不乱码）
- 无结果时隐藏导出按钮

## 不执行 git commit/push
