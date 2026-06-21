# Claude Code 任务单：v2-105 — 最终质量审查与优化

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
执行最终全项目质量审查，消除所有已知问题，确保项目达到发布就绪状态。

## 必须实现
1. 全局搜索 TODO/FIXME/HACK 注释，评估并处理
2. 检查所有 i18n key 是否有中英文对应翻译
3. 检查所有 CSS 是否使用主题变量（无硬编码颜色）
4. 检查前端所有按钮是否绑定真实事件
5. 检查所有 Tauri command 前后端名称一致性
6. 输出审查报告到 `docs/QUALITY-AUDIT.md`

## 不破坏
- 现有所有功能
- npm run check 全部 8 项 PASS

## 验收标准
- 审查报告完整
- npm run check 全部 PASS
- 不执行 git commit/push