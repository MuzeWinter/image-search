# Claude Code 任务单：v2-100 — 项目文档与使用指南

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
完善项目文档，确保新用户可快速上手。

## 必须实现
1. 更新 `README.md`：项目介绍、功能列表、安装步骤、使用说明
2. 新增 `docs/USER-GUIDE.md`：详细使用指南（搜索、资料库、设置、导出）
3. 新增 `docs/DEV-GUIDE.md`：开发指南（架构、技术栈、构建、调试）
4. 新增 `docs/CHANGELOG.md`：版本变更记录

## 不破坏
- 现有代码和测试
- npm run check 全部 8 项 PASS

## 验收标准
- 三份文档内容完整、格式正确
- npm run check 全部 PASS
- 不执行 git commit/push