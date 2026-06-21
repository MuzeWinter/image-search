# Claude Code 任务单：v2-63 — 代码最终清理与注释精简

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
移除所有 `@ts-nocheck`、未使用的 import、调试 console.log，统一代码风格。

## 必须实现
- 移除所有 `// @ts-nocheck`
- 移除注释掉的旧代码
- 清理未使用的 import
- 统一缩进和空行

## 验收标准
- `npm run build` 零错误
- `npx tsc --noEmit` 零错误

## 不执行 git commit/push
