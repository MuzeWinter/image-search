# Claude Code 任务单：v2-26 — 系统托盘最小化

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
关闭窗口时最小化到系统托盘而非退出。右键托盘图标可退出。

## 必须实现

### 1. Rust 端 (src-tauri/src/main.rs)
- 使用 tauri 的 tray 功能
- 监听窗口关闭事件 → 隐藏窗口 (不是退出)
- 托盘图标右键菜单：显示窗口 / 退出
- 托盘图标双击：显示窗口
- `cargo add tauri-plugin-tray` 或使用内置 `tray-icon` feature

### 2. 验收标准
- `cargo build` 零错误
- 点击关闭 → 最小化到托盘
- 托盘右键可退出
- 托盘双击恢复窗口

## 不执行 git commit/push
