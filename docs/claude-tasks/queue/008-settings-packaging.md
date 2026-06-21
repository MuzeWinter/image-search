# Claude Code 任务单：008 — 设置页完善 + Tauri Windows 打包配置

## 角色

遵守项目全部规则文件。

## 本次目标

设置页添加真实文件夹选择 + 配置 Windows 打包。

## 必须实现

### 1. 设置页文件夹选择
- 资料库路径输入框旁添加"浏览"按钮
- 点击调用 Tauri dialog open 选择文件夹
- 选中后自动填入路径
- 支持手动输入路径
- 添加资料库按钮真实调用 libraryService.add()

### 2. 备份/恢复/重建功能
- 添加"备份数据库"按钮 → 调用 settingsService.backup → 弹出保存对话框
- 添加"恢复数据库"按钮 → 调用 settingsService.restore → 弹出打开对话框
- 添加"重建索引"按钮 → 调用 settingsService.rebuildIndex → 确认后执行
- 添加"清理缓存"按钮 → 调用 settingsService.clearCache → 确认后执行

### 3. Tauri 打包配置
- `tauri.conf.json` 添加 `bundle` 配置：
  - `active: true`
  - `targets: "msi"`
  - `icon` 指向已有图标文件
  - `windows.wix` 基本配置

### 4. 首次启动引导完善
- 如果资料库为空，首页显示友好引导卡片
- 点击"添加第一个资料库"跳转到设置或资料库管理

## 建议修改文件
- `src/pages/Settings.tsx`
- `src/pages/Home.tsx`
- `src/i18n/zh.json`
- `src/i18n/en.json`
- `src-tauri/tauri.conf.json`
- `backend/services/settings_service.py`（如需要）

## 禁止事项
- 不许删原有功能
- 不许用 mock
- 不许 git commit/push

## 验收标准
- 设置页可浏览选择文件夹
- 备份/恢复按钮真实调用后端
- `npm run build` + `cargo build` 通过
- `cargo tauri build` 可生成 .msi
