# Claude Code 任务单：v2-86 — 前端组件单元测试

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
为关键前端组件创建 Vitest 单元测试。

## 必须实现
- `src/__tests__/` 目录
- `Toast.test.tsx` — Toast 显示/消失
- `Search.test.tsx` — 搜索状态流转
- `EmptyState.test.tsx` — 空状态渲染
- 配置 vitest + jsdom

## 验收标准
- `npx vitest run` 全部通过

## 不执行 git commit/push
