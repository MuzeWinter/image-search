# Claude Code 任务单：v2-13 — Toast 通知集成到页面

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
将 Toast 通知系统集成到 Search/Library/Settings 三个页面，替换原有的 `alert()`/`window.confirm()`/静默错误。

## 必须实现

### 1. Search.tsx 集成 Toast
- 导入 `useToast` from `../contexts/ToastContext`
- 搜索失败时用 `addToast("error", ...)` 替代纯 `setErrorMsg`
- 保留 `setErrorMsg` 用于内联错误显示
- 复制路径成功时用 `addToast("success", t("search.copied"))` 反馈

### 2. Library.tsx 集成 Toast  
- 导入 `useToast`
- 添加资料库成功/失败用 toast
- 删除资料库成功/失败用 toast
- 扫描完成/取消用 toast
- 保留 `window.confirm` 用于删除确认（用户交互不可替代）

### 3. Settings.tsx 集成 Toast
- 导入 `useToast`
- 备份成功/失败用 toast（替代 `showMaintMsg` 或配合使用）
- 恢复成功/失败用 toast
- 重建索引用 toast
- 清空缓存用 toast
- UG 列名保存用 toast
- 保留 `window.confirm` 用于危险操作确认

## 验收标准
- `npm run build` 零错误
- 所有 toast 消息使用 i18n key
- 不破坏任何原有功能
- Toast 在深色/浅色主题下均可读

## 不执行 git commit/push
