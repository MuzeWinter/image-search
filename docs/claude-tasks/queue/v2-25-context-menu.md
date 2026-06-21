# Claude Code 任务单：v2-25 — 右键菜单：搜索结果操作

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索结果项支持右键菜单：打开图片、打开所在文件夹、复制路径、复制 UG 编号。

## 必须实现

### 1. ContextMenu 组件
- 新建 `src/components/shared/ContextMenu.tsx`
- 支持：打开图片 / 打开所在文件夹 / 复制路径 / 复制 UG 编号
- 深色/浅色主题适配
- 点击菜单外部自动关闭

### 2. Search.tsx 集成
- 搜索结果卡片绑定右键事件
- 传入 `item` 数据给 ContextMenu
- 菜单位置跟随鼠标

### 3. 验收标准
- `npm run build` 零错误
- 右键弹出菜单，功能正常
- 深色/浅色主题均可读

## 不执行 git commit/push
