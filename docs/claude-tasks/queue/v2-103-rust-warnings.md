# Claude Code 任务单：v2-103 — Rust 警告清零与代码整洁

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
消除所有 Rust 编译警告，确保代码零警告编译。

## 必须实现
1. 修复 `export.rs` 中 `ocr_text` 字段未读警告
2. 运行 `cargo clippy` 检查并修复所有 warning
3. 确保 `cargo build` 零警告输出
4. 在 `scripts/check.mjs` 的 cargo build 步骤中检测警告

## 不破坏
- 现有所有功能
- npm run check 全部 8 项 PASS
- CLI/API 接口

## 验收标准
- `cargo build` 零警告
- `cargo clippy` 零警告
- npm run check 全部 PASS
- 不执行 git commit/push