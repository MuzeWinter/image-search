# Claude Code 任务单：v2-106 — ESLint 警告清零与代码规范强化

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
消除唯一剩余 ESLint 警告，强化代码规范。

## 必须实现
1. 修复 `src/App.tsx:297` react-hooks/exhaustive-deps 警告
2. 配置 ESLint 将 warning 级规则提升为 error
3. 确保 `npm run lint` 零警告零错误

## 不破坏
- 现有所有功能
- npm run check 全部 8 项 PASS

## 验收标准
- `npm run lint` 零警告零错误
- npm run check 全部 PASS
- 不执行 git commit/push