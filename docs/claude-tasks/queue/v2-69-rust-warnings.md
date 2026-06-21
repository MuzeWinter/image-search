# Claude Code 任务单：v2-69 — rust代码Warnings清理

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
清除 `cargo build` 的所有 warnings。

## 必须实现
- 运行 `cargo build` 收集所有 warning
- 逐一修复：未使用变量加 `_`、未使用 import 删除
- 零 warning

## 验收标准
- `cargo build 2>&1 | Select-String warning` 无输出

## 不执行 git commit/push
