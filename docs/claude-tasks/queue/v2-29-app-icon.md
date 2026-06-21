# Claude Code 任务单：v2-29 — 应用图标生成

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
生成 Tauri 打包所需的应用图标文件。

## 必须实现

### 1. 图标生成
- 使用 canvas/SVG 生成简洁图标：放大镜 + 齿轮组合
- 输出到 `src-tauri/icons/` 目录
- 需要的尺寸：32x32, 128x128, 256x256 (128x128@2x), icon.ico

### 2. 实现方式
- 用 Node.js 脚本生成（canvas 或纯 SVG→PNG）
- 确保图标在深色/浅色任务栏都可见
- 备用：如无法生成，验证 `src-tauri/icons/` 目录和 `tauri.conf.json` 中的图标配置一致

### 3. 验收标准
- `cargo build` 零错误（不因图标缺失报错）
- `src-tauri/icons/` 包含所需图标文件或占位文件

## 不执行 git commit/push
