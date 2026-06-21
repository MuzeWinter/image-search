# Claude Code 任务单：v2-32 — 平滑页面过渡动画

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
页面切换时添加平滑淡入过渡动画，消除切换时的视觉跳动。

## 必须实现

### 1. 过渡动画 (App.tsx / AppShell.tsx)
- 使用 CSS transition 或 framer-motion（如已安装）
- 页面进入：fade in + 轻微上移 (translateY 8px → 0)
- 页面退出：fade out
- 时长：200ms，ease-out

### 2. CSS
- 在 shell.css 或新文件添加动画
- 不影响页面首次加载性能
- 深色/浅色主题下背景色过渡自然

### 3. 验收标准
- `npm run build` 零错误
- 页面切换有平滑动画
- 不影响现有功能

## 不执行 git commit/push
