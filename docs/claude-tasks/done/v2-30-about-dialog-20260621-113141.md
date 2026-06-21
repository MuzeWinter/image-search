# Claude Code 任务单：v2-30 — 关于对话框

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
设置页增加"关于"按钮，弹出信息对话框显示版本号、技术栈、GitHub 链接。

## 必须实现

### 1. 关于对话框 (Settings.tsx)
- 点击"关于"按钮弹出模态框
- 显示：应用名称、版本号(从 tauri.conf.json 读取)
- 技术栈图标行：Tauri/React/Python/CLIP/FAISS
- GitHub 链接可点击

### 2. 对话框样式
- 深色/浅色主题适配
- 关闭按钮 + 点击外部关闭

### 3. 验收标准
- `npm run build` 零错误
- 版本号从 package.json 或 tauri.conf.json 动态读取

## 不执行 git commit/push
