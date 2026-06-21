# Claude Code 任务单：v2-94 — npm run check 脚本完善

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
确保 `npm run check` 包含所有质量门禁，并输出清晰的汇总。

## 必须实现
- 各步骤输出 PASS/FAIL
- 汇总显示通过/失败数
- 非零退出码正确传递

## 验收标准
- `npm run check` 全部 PASS 输出

## 不执行 git commit/push
