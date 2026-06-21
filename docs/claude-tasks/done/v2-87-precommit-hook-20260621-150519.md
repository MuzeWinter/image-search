# Claude Code 任务单：v2-87 — pre-commit Git Hook

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
创建 pre-commit hook，提交前自动运行构建验证。

## 必须实现
- `scripts/setup-git-hooks.sh` / `.ps1`
- pre-commit: `npm run build` + Python 语法检查
- 失败阻止提交

## 验收标准
- hook 安装后 `git commit` 前自动验证

## 不执行 git commit/push
