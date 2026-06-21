# Claude Code 任务单：v2-19 — 键盘快捷键支持

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
添加全局键盘快捷键，提升操作效率。

## 必须实现

### 快捷键
- `Ctrl+1` → 切换到搜索页
- `Ctrl+2` → 切换到资料库页
- `Ctrl+3` → 切换到设置页
- `Ctrl+V` → 粘贴图片搜索（已有）
- `Escape` → 取消扫描/清空搜索

### 实现
- 在 `AppShell.tsx` 或新建 `src/hooks/useKeyboardShortcuts.ts` 中监听
- 使用 `useEffect` + `keydown` 事件
- 仅在主窗口聚焦时生效（不在输入框内时）

### 验收标准
- `npm run build` 零错误
- `Ctrl+1/2/3` 切换页面正常
- 在 input/textarea 内不触发快捷键

## 不执行 git commit/push
