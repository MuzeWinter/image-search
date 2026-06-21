# Claude Code 任务单：v2-37 — 模型加载启动画面

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
首次启动或模型加载时显示启动画面，展示品牌 Logo 和加载进度。

## 必须实现

### 1. SplashScreen 组件
- 新建 `src/components/SplashScreen.tsx`
- 显示应用名 + 版本号
- 加载进度条（百分比）
- 加载状态文字

### 2. 集成 (App.tsx)
- 在 Search 页首次搜索触发模型加载时显示
- 或在 App 启动时检查模型状态
- 加载完成自动消失

### 3. 验收标准
- `npm run build` 零错误
- 深色/浅色主题适配
- 不阻塞用户使用其他页面

## 不执行 git commit/push
