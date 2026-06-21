# Claude Code 任务单：v2-109 — 启动性能优化

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
优化应用启动速度，确保用户打开软件无卡顿无等待。

## 必须实现
1. React 代码分割（lazy + Suspense），非首页组件按需加载
2. 图片懒加载优化（IntersectionObserver）
3. Python 后端延迟初始化（首次使用时才加载模型）
4. 启动时仅加载必要配置，其余延迟加载
5. SplashScreen 显示实际加载进度

## 不破坏
- 现有所有功能
- npm run check 全部 8 项 PASS
- 首屏渲染正确

## 验收标准
- 启动时间显著缩短
- 页面切换流畅
- npm run check 全部 PASS
- 不执行 git commit/push