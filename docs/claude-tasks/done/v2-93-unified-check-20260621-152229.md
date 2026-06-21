# Claude Code 任务单：v2-93 — 综合lint脚本

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
创建统一 `npm run check` 脚本，一键运行所有检查。

## 必须实现
- tsc --noEmit
- eslint
- vite build
- cargo build
- python 语法
- mypy (如已配置)
- pytest

## 验收标准
- `npm run check` 全部通过

## 不执行 git commit/push
