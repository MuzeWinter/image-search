# Claude Code 任务单：v2-115 — 项目最终全量质量验证

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
运行最终全量质量验证，确认 v2 系列全部达标。

## 必须实现
1. 运行 npm run check 全量验证
2. 运行 npm run build:release 生产构建
3. 检查所有 i18n 翻译完整性
4. 检查所有按钮事件绑定
5. 更新 RELEASE-CHECKLIST 标记完成项

## 不破坏
- 现有所有功能

## 验收标准
- npm run check 8/8 PASS
- npm run build:release 成功
- 不执行 git commit/push