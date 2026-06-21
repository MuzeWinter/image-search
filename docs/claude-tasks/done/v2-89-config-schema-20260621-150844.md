# Claude Code 任务单：v2-89 — 配置文件Schema验证

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
为 tauri.conf.json 和 automation.config.json 添加 JSON Schema 引用或验证脚本。

## 必须实现
- tauri.conf.json 已有 schema，确认 URL 正确
- automation.config.json 添加 describe/comments
- 创建 `scripts/validate-configs.ps1` 验证所有 JSON 配置文件

## 验收标准
- 脚本运行通过
- JSON 格式正确

## 不执行 git commit/push
