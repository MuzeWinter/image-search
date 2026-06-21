# Claude Code 任务单：v2-34 — 最终集成审查

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
全项目最终审查：构建零错误、类型零警告、所有文件符合规范。

## 必须实现

### 1. 构建验证
- `npm run build` 零错误
- `npx tsc --noEmit` 零错误、零警告
- `cargo build` 零错误
- `python -m py_compile backend/main.py` 通过

### 2. 文件完整性
- 所有 import 路径有效
- 所有 i18n 键 zh.json ↔ en.json 匹配
- 所有 CSS 文件被 main.tsx 引用

### 3. 配置验证
- tauri.conf.json 合法 JSON
- capabilities/default.json 权限正确
- automation.config.json 匹配项目结构

### 4. 如发现问题，修复它们

## 验收标准
- 所有检查通过
- 输出审查报告到 `.codex-review/final-review.md`

## 不执行 git commit/push
