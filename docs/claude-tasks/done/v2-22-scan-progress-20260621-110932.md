# Claude Code 任务单：v2-22 — 扫描进度增强 (实时文件名+预估时间)

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
扫描时显示更详细的进度信息：当前文件名、已用时间、预估剩余时间。

## 必须实现

### 1. 后端 (scan_service.py)
- 在扫描每个文件时 emit 当前文件名
- 计算并 emit 已用时间和预估剩余时间
- 进度百分比精确到 1%

### 2. 前端 (Library.tsx)
- 扫描进度区域显示：当前处理文件（截断路径）
- 显示 "已用: Xs / 预估剩余: Ys"
- 进度条动画平滑

### 3. 验收标准
- `npm run build` 零错误
- 扫描进度实时更新
- 文件名显示正确

## 不执行 git commit/push
