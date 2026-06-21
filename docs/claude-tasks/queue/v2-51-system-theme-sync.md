# Claude Code 任务单：v2-51 — 深色主题自动跟随系统

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
当主题设置为"跟随系统"时，监听 Windows 系统主题变化并实时切换。

## 必须实现
- ThemeContext 中 useTheme 监听 `matchMedia('(prefers-color-scheme: dark)')`
- 系统主题变化时自动更新应用主题（仅当当前设置为"system"）
- 同时更新 CSS 变量

## 验收标准
- `npm run build` 零错误
- Windows 切换深色/浅色模式时应用跟随

## 不执行 git commit/push
