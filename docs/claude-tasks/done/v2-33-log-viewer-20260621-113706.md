# Claude Code 任务单：v2-33 — 日志查看器

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
设置页增加日志查看功能，显示最近的扫描日志和错误日志。

## 必须实现

### 1. 后端 (db_service.py)
- 新增 activity_logs 表：时间、级别(info/warn/error)、来源、消息
- 扫描/搜索时自动记录日志

### 2. 前端 (Settings.tsx)
- "日志"区域显示最近 50 条日志
- 按级别颜色区分（info=灰, warn=黄, error=红）
- 支持按级别过滤

### 3. 验收标准
- `npm run build` 零错误
- 扫描后产生日志记录
- 深色/浅色主题下日志可读

## 不执行 git commit/push
