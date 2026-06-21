# Claude Code 任务单：v2-18 — 启用 TypeScript 严格模式 + 修复类型警告

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
在 tsconfig.json 中启用 strict 模式，修复所有类型错误，确保零类型警告。

## 必须实现

### 1. tsconfig.json
- `strict: true`
- `noUnusedLocals: true`
- `noUnusedParameters: true`

### 2. 修复类型错误
- 所有 `any` 类型改为具体类型
- 所有可选参数明确标注
- 所有 Promise 泛型明确
- 修复可能为 null/undefined 的访问

### 3. 不破坏功能
- 类型修复不应改变运行时行为
- 使用 `as` 强制转换时加注释说明原因

## 验收标准
- `npx tsc --noEmit` 零错误、零警告
- `npm run build` 零错误
- 所有页面功能保持不变

## 不执行 git commit/push
