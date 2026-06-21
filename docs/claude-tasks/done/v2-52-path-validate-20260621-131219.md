# Claude Code 任务单：v2-52 — 资料库路径有效性检查

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
启动时检查所有已添加资料库路径是否存在，不存在的标记为"不可用"并提示用户。

## 必须实现
- App.tsx 启动时遍历资料库列表
- 路径不存在：StatusBar 警告图标 + 数量
- Library 页面：不可用资料库灰色显示 + 警告图标
- Toast 提示哪些路径不可用

## 验收标准
- `npm run build` 零错误
- 外接硬盘拔出后路径显示不可用

## 不执行 git commit/push
