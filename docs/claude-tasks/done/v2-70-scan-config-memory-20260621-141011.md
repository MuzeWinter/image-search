# Claude Code 任务单：v2-70 — 扫描时记忆上次参数

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
资料库扫描时记住上次的扫描配置（扩展名、是否OCR、是否提取UG预览），下次扫描自动使用。

## 必须实现
- localStorage 存储上次扫描配置
- 扫描时读取配置
- 设置页显示当前扫描配置

## 验收标准
- `npm run build` 零错误
- 重启后配置保留

## 不执行 git commit/push
