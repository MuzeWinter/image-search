# Claude Code 任务单：v2-90 — ESLint配置与代码规范

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
添加 ESLint 配置，自动修复代码风格问题。

## 必须实现
- `.eslintrc.json` 或 `eslint.config.mjs`
- React + TypeScript 规则
- `npm run lint` 脚本
- 修复现有 lint 错误

## 验收标准
- `npm run lint` 零错误

## 不执行 git commit/push
