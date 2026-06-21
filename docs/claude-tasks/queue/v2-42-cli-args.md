# Claude Code 任务单：v2-42 — 命令行参数支持

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
支持通过命令行参数启动：指定资料库路径自动扫描、指定图片自动搜索。

## 必须实现

### 1. Rust 端 (src-tauri/src/main.rs)
- 解析 `--scan <path>` 参数：启动后自动添加并扫描
- 解析 `--search <image_path>` 参数：启动后自动搜索

### 2. 前端
- 监听 Rust 端传递的启动参数
- 自动执行相应操作

### 3. 验收标准
- `cargo build` 零错误
- `--scan` 参数生效

## 不执行 git commit/push
