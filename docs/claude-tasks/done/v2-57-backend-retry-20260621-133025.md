# Claude Code 任务单：v2-57 — Rust 后端连接重试

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
Python 后端调用失败时自动重试（最多2次），间隔500ms，提升稳定性。

## 必须实现
- src-tauri/src/main.rs 的 call_backend 增加重试逻辑
- 仅对连接类错误重试（非业务错误）
- 重试次数和间隔可配置

## 验收标准
- `cargo build` 零错误
- Python 进程瞬发崩溃时自动重试

## 不执行 git commit/push
