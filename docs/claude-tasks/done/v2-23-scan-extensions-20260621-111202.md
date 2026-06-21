# Claude Code 任务单：v2-23 — 配置持久化：扫描扩展名白名单

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
在设置页增加扫描文件扩展名配置，让用户控制扫描哪些类型的文件。

## 必须实现

### 1. 后端 (settings_service.py)
- 新增 `settings.get` / `settings.set` 支持 `scan_extensions` 键
- 默认值：`[".xlsx", ".xls", ".prt"]`

### 2. 前端 (Settings.tsx)
- 在"数据"区域新增扩展名多选框
- 至少显示：.xlsx / .xls / .prt
- 允许用户添加自定义扩展名
- 修改后实时保存到后端

### 3. 扫描时使用 (scan_service.py)
- 读取 `scan_extensions` 配置
- 只扫描匹配扩展名的文件

### 4. 验收标准
- `npm run build` 零错误
- 设置页修改扩展名后保存成功
- 下次扫描时只处理选中扩展名文件
- 配置重启后保留

## 不执行 git commit/push
