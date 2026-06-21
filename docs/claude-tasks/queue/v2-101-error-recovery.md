# Claude Code 任务单：v2-101 — 错误边界与崩溃恢复加固

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
加固应用稳定性，确保任何前端/后端异常都不会导致白屏或静默崩溃。

## 必须实现
1. React ErrorBoundary 覆盖所有主要页面组件（Search/Library/Settings）
2. 后端 Python 进程崩溃自动重启（Tauri sidecar 守护）
3. 全局未捕获异常上报（前端 window.onerror + 后端日志）
4. 数据库损坏自动修复（SQLite integrity_check + 自动重建）
5. 配置文件损坏自动恢复默认值

## 不破坏
- 现有所有功能
- npm run check 全部 8 项 PASS
- 现有 90+42=132 测试全部通过

## 验收标准
- 组件级错误不导致白屏
- 后端重启后可恢复
- npm run check 全部 PASS
- 不执行 git commit/push