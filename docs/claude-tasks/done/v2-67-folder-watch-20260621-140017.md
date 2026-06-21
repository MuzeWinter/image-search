# Claude Code 任务单：v2-67 — 资料库文件夹监控自动扫描

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
开启"自动监控"后，资料库文件夹有文件变化时自动触发增量扫描。

## 必须实现
- Settings 增加"自动监控新文件"开关
- Rust 端使用 notify crate 监听文件夹变化
- 防抖 5 秒后触发增量扫描
- 监控状态在 StatusBar 显示

## 验收标准
- `cargo build` 零错误
- 向资料库添加文件后自动检测

## 不执行 git commit/push
