# Claude Code 任务单：v2-75 — 退出时自动备份数据库

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
应用退出时自动备份数据库到 `backend/data/backups/`（保留最近5份）。

## 必须实现
- Rust 端监听 close_requested 事件
- 调用 Python `db.backup` 方法
- 备份文件名：`zoobet-YYYYMMDD-HHMMSS.db`
- 超过5份自动删除最旧的

## 验收标准
- `cargo build` 零错误
- 退出后 backups/ 目录生成备份
- 超过5份时自动清理

## 不执行 git commit/push
