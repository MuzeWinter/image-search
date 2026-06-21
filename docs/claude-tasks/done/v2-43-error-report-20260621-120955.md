# Claude Code 任务单：v2-43 — 错误报告生成器

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
发生严重错误时自动收集诊断信息，生成错误报告文件方便用户反馈。

## 必须实现

### 1. 错误收集
- 收集：系统信息、Python版本、依赖版本、数据库状态、最近日志
- 生成时间戳命名的 .zip 包
- 位置：用户文档目录

### 2. 触发时机
- 未捕获的 Rust panic
- Python 后端连续 3 次启动失败
- 数据库损坏检测

### 3. 验收标准
- `cargo build` 零错误
- `npm run build` 零错误
- 错误报告包含完整诊断信息

## 不执行 git commit/push
