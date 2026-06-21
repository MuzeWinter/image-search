# Claude Code 任务单：v2-83 — Rust Release构建验证

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
执行 `cargo build --release` 确保 release 模式零错误。

## 必须实现
- 运行 release 构建
- 修复任何 release-only 的编译问题

## 验收标准
- `cargo build --release` 零错误

## 不执行 git commit/push
