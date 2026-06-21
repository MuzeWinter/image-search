# Claude Code 任务单：v2-61 — ai_service.py 加载超时保底

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
AI 模型加载超过 120 秒时自动取消，显示清晰错误信息，不阻塞应用。

## 必须实现
- 模型加载增加超时检测（120s）
- 超时后设置 _LOAD_FAILED_MSG = "模型加载超时"
- 前端显示"加载超时，请检查网络或重试"
- 支持手动重试按钮

## 验收标准
- 模型加载超时时前端有反馈
- 超时不影响其他页面

## 不执行 git commit/push
