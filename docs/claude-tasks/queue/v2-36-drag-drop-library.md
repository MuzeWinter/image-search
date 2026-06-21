# Claude Code 任务单：v2-36 — 拖放文件夹到资料库快速添加

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
在资料库页面支持拖放文件夹到列表区域，自动添加为资料库。

## 必须实现

### 1. 拖放 (Library.tsx)
- 监听 dragover/drop 事件
- 验证拖入的是文件夹路径
- 自动调用 libraryService.add
- 拖放时显示视觉反馈

### 2. 验收标准
- `npm run build` 零错误
- 拖放文件夹自动添加
- 重复路径提示

## 不执行 git commit/push
