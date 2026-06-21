# Claude Code 任务单：v2-81 — GIT仓库瘦身清理

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
89 commits 产生大量 loose objects，执行 git gc 和 prune 优化仓库。

## 必须实现
- `git gc --aggressive --prune=now`
- 验证仓库完整性 `git fsck`
- 确认 .git 目录大小变化

## 验收标准
- 仓库完整无损坏
- .git 目录大小减小

## 不执行 git commit/push
