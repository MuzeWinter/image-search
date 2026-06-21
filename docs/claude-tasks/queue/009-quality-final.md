# Claude Code 任务单：009 — 代码质量收尾 + 构建验证 + 自检

## 角色

遵守项目全部规则文件（AGENTS.md / CLAUDE.md / AI-CODING-RULES.md）。

## 本次目标

全面自检：确保所有页面真实可用、无残问题、构建通过。

## 必须实现

### 1. 全面构建验证
- `npm run build` 必须零错误零警告
- `cargo build` 必须通过
- `cargo tauri build` 尝试生成 .msi（如环境支持）

### 2. 逐页检查
检查以下每个页面是否有 `useServiceQuery` 调用真实后端：
- ✅ Search / ImageLibrary / Library / ScanReport / MatchManagement
- ✅ CadFiles / ExcelRecords / PdfFiles / Tags / Favorites
- ✅ Settings / Changelog / Home

### 3. 前后端接口对齐
- 前端 invoke 名称与 Rust command 名称一致
- 前端 invoke 参数与 Rust command 参数类型一致
- 后端 JSON-RPC method 名称与 Python 路由一致

### 4. 深色主题扫尾
- 检查所有新增 CSS 类是否有 `[data-theme="dark"]` 适配
- 按钮、输入框、下拉框、弹窗在深色主题下可读

### 5. i18n 补全
- 所有 `t("xxx")` 调用在两份 JSON 中都有对应 key
- 无 `undefined` 或 fallback 占位

### 6. 危险操作二次确认
- 删除资料库 → 弹窗确认
- 删除图片 → 弹窗确认
- 清空缓存 → 弹窗确认
- 重建索引 → 弹窗确认

## 建议修改范围

按需修改，不做大范围重构。

## 禁止事项
- 不许删原有功能
- 不许为了消除报错删除代码
- 不许 git commit/push

## 验收标准
- `npm run build` 零错误
- `cargo build` 通过
- 所有页面深色主题下可读
- 所有页面中英文完整
