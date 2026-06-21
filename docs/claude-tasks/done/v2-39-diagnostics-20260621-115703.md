# Claude Code 任务单：v2-39 — 系统健康检查诊断页

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
设置页增加系统诊断功能，检查所有依赖和环境状态。

## 必须实现

### 1. 诊断检查项
- Python 环境 (版本、路径)
- pip 依赖 (torch, open_clip, faiss, PIL)
- 数据库 (连接、大小、表完整性)
- 磁盘空间 (资料库所在盘)
- NXOpen 可用性
- FAISS 索引状态

### 2. 前端 (Settings.tsx)
- "系统诊断"按钮
- 诊断结果列表（绿色勾/红色叉）
- 如有问题，显示修复建议

### 3. 验收标准
- `npm run build` 零错误
- 所有检查项正确报告状态
- 深色/浅色主题适配

## 不执行 git commit/push
