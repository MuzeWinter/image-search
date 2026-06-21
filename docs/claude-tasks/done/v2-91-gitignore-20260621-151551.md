# Claude Code 任务单：v2-91 — .gitignore 完善

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
审查并完善 .gitignore，确保无敏感文件或构建产物被误提交。

## 必须实现
- 添加 __pycache__/, *.pyc
- 添加 .codex-review/
- 添加 node_modules/
- 验证 git status 干净

## 验收标准
- 无构建产物出现在 git status

## 不执行 git commit/push
