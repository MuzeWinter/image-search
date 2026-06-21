# Claude Code 任务单：v2-17 — 窗口状态记忆

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
记住并恢复窗口位置、大小、最大化状态。重启软件后恢复到上次关闭时的状态。

## 必须实现

### 1. Rust 端 (src-tauri/src/main.rs)
- 添加 `save_window_state(window_label, x, y, width, height, maximized)` 命令
- 添加 `load_window_state(window_label)` 命令
- 窗口关闭时自动保存状态（监听 close requested 事件）
- 窗口创建后自动恢复状态
- 存储位置：`window_state.json` 在 app data 目录

### 2. 前端
- 无需修改（Rust 端自动处理）

### 3. 边界条件
- 多显示器：如果保存的位置在当前屏幕外，回退到默认位置
- 窗口最小尺寸不应小于 minWidth/minHeight
- 最大化状态优先于位置/尺寸

## 验收标准
- `cargo build` 零错误
- `npm run tauri dev` 启动后窗口恢复上次位置和大小
- 最大化→关闭→重开→仍为最大化
- 拖动窗口→关闭→重开→在原位置

## 不执行 git commit/push
