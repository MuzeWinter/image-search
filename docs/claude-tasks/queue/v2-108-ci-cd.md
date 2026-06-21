# Claude Code 任务单：v2-108 — CI/CD 流水线完善

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
完善 GitHub Actions CI/CD，确保每次推送自动验证全栈质量。

## 必须实现
1. CI workflow 增加 vitest 前端测试步骤
2. CI workflow 增加 cargo clippy 检查
3. CI workflow 增加 Rust test 步骤
4. CI 失败时自动在 PR/commit 上标注状态
5. 优化 CI 缓存策略（node_modules、cargo、pip）

## 不破坏
- 现有 CI workflow
- npm run check 全部 8 项 PASS

## 验收标准
- CI 包含所有质量门禁
- npm run check 全部 PASS
- 不执行 git commit/push