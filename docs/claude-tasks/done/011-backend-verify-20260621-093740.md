# Claude Code 任务单：011 — Python 后端可运行性验证 + 测试数据

## 角色

遵守项目全部规则文件。

## 本次目标

验证 Python 后端可以实际运行，数据库可以建表，扫描可以执行。

## 必须实现

### 1. 后端启动验证
- `python backend/main.py` 可以启动并等待 stdin 输入
- 发送 `{"jsonrpc":"2.0","id":1,"method":"db.init","params":{}}` 得到成功响应
- 数据库文件在项目根目录创建（或配置目录）

### 2. 数据库验证
- `backend/db/schema.sql` 可以被正确执行
- 所有表创建成功
- 基本 CRUD 测试通过

### 3. 扫描功能验证
- 创建一个测试文件夹，放入示例文件
- 运行 `python backend/services/scan_service.py --library-id 1 --path ./test-data`
- 验证扫描输出正确的 JSON 结果

### 4. 创建测试数据脚本
- `backend/scripts/seed_test_data.py`：创建示例数据
  - 创建测试文件夹结构
  - 放入几个占位图片文件
  - 放入一个示例 Excel
- `backend/scripts/verify_backend.py`：运行所有后端功能的自检脚本

### 5. 前端 IPC 通路验证
- 确保 `call_backend` Tauri command 能在开发模式下调用 Python
- 确保 `scan_library` Tauri command 能启动扫描并返回进度

## 建议修改文件
- `backend/scripts/seed_test_data.py`（新建）
- `backend/scripts/verify_backend.py`（新建）
- 可能修复 `backend/main.py` 或服务模块中的 bug

## 禁止事项
- 不许修改前端功能
- 不许 git commit/push

## 验收标准
- `python backend/main.py` 可启动
- 数据库可建表
- 扫描脚本可运行
- 前端 Tauri IPC 通路正常
