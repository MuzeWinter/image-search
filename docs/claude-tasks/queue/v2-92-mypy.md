# Claude Code 任务单：v2-92 — Python mypy类型检查

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
为 Python 后端添加 mypy 静态类型检查配置。

## 必须实现
- `mypy.ini` 或 `pyproject.toml` [mypy] 配置
- 修复关键文件的类型注解
- `npm run lint:py` 或 `python -m mypy backend/`

## 验收标准
- mypy 检查通过

## 不执行 git commit/push
