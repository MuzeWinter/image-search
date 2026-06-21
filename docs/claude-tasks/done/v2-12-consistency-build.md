# Claude Code 任务单：v2-12 — 命名一致化 + Cargo 构建验证

遵守全部规则文件。

## 目标
修复命名不一致 + 全链路构建验证。

## 必须实现
1. Sidebar 中 key "library" 和路由 "/libraries" 一致化 → 统一用 "library"
2. 确认 Library.tsx/Search.tsx/Settings.tsx 都正确导入所需服务
3. `npm run build` 零错误
4. `cargo build` 零错误
5. `python backend/main.py` 可启动（语法验证）
6. 确认 vite.config.ts 代码分割正确（3个页面独立 chunk）

## 不执行 git commit/push
