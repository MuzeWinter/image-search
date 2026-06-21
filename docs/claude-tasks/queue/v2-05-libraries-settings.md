# Claude Code 任务单：v2-05 — 资料库+设置页面

遵守全部规则文件。

## 目标
重写 Libraries.tsx 和 Settings.tsx。

## Libraries.tsx
- 显示资料库路径、图片数量、PRT 数量、状态
- "浏览"按钮 → Tauri dialog 选择文件夹
- "开始扫描"按钮 → 触发扫描 + 实时进度条
- 进度条显示阶段名 + 当前文件 + 百分比

## Settings.tsx
- 主题选择 (light/dark/system)
- 语言选择 (zh/en)
- UG 编号列名输入框 (默认"图号")
- 设置保存到 localStorage

## 必须实现
1. 两个页面中英文完整
2. `npm run build` 零错误
3. 所有按钮真实可用

## 不执行 git commit/push
