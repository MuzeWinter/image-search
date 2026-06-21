# Claude Code 任务单：v2-110 — 项目发布就绪最终验证

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
执行项目发布就绪状态最终验证，确认 v2 系列全部完成。

## 必须实现
1. 运行 `npm run check` 确认全绿
2. 检查所有 done 任务数量与质量
3. 验证 git log 提交信息完整性
4. 更新 `docs/CHANGELOG.md` 汇总 v2.94-v2.110 变更
5. 生成项目发布检查清单 `docs/RELEASE-CHECKLIST.md`

## 不破坏
- 现有所有功能
- npm run check 全部 8 项 PASS

## 验收标准
- npm run check 全绿
- CHANGELOG 更新完整
- 发布检查清单生成
- 不执行 git commit/push