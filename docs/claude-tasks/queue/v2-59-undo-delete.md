# Claude Code 任务单：v2-59 — 安全文件删除确认 (撤销缓冲)

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
资料库删除操作增加5秒撤销缓冲，而非立即从数据库删除。

## 必须实现
- 删除后5秒内显示"已删除，点击撤销"
- 5秒后真正执行删除
- 期间其他操作不冲突

## 验收标准
- `npm run build` 零错误
- 撤销后资料库恢复

## 不执行 git commit/push
