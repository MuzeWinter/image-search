# Claude Code 任务单：v2-80 — 最终全面构建验证

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
执行最终全链路构建验证，确保所有组件正确。

## 必须检查
- `npm run build` 零错误
- `cargo build` 零错误零警告
- 所有 CSS 被引用
- 所有 i18n 键完整
- 性能审计报告更新
- FEATURES.md 更新

## 验收标准
- 全部检查通过
- 输出 `docs/final-verification.md`

## 不执行 git commit/push
