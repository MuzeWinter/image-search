# Claude Code 任务单：Phase 2 — 服务注册中心 + 数据库 + 设置持久化

## 角色

你是本项目的代码实现 Agent，只负责写代码。遵守项目全部规则文件。

## 本次目标

实现前端 Service Registry（服务注册中心）+ 与 Python 后端通信 + SQLite 数据库 + 设置持久化。

## 当前已有基础

- `src/`: Phase 1 完成的 Shell + 12 个页面骨架
- `src-tauri/`: Tauri 配置，无标题栏窗口
- `src/services/`: 空目录
- `docs/DESIGN-PLAN.md`: 第四节 服务注册中心设计 + 第七节 数据库表结构

## 必须实现

### 1. Service Registry（前端服务层）
- `src/services/registry.ts`: ServiceRegistry 类
  - `register(descriptor)`: 注册服务
  - `get(name)`: 获取服务
  - `ensureReady(name)`: 自动启动服务（幂等）
  - 服务状态: idle → starting → ready → error
- `src/services/types.ts`: 所有服务接口的 TypeScript 类型定义

### 2. 与 Python 后端通信
- 在 `src-tauri/src/main.rs` 中添加 Tauri commands，通过 sidecar 调用 Python
- Python sidecar 脚本 `backend/main.py`: JSON-RPC 入口
  - 监听 stdin，逐行读取 JSON 请求
  - 根据 method 路由到对应服务模块
  - 返回 JSON 响应到 stdout
- 前端 `invoke()` 调用后端，带超时和错误处理

### 3. 数据库服务
- `src/services/dbService.ts`: 数据库 CRUD 封装
- Python `backend/services/db_service.py`: SQLite 操作
- `backend/db/schema.sql`: 建表语句（从设计文档复制完整 SQL）
- Python `backend/db/connection.py`: 连接管理（WAL 模式）

### 4. 设置服务
- `src/services/settingsService.ts`: 设置读写
- Python `backend/services/settings_service.py`: SQLite key-value 存取
- 设置页 (`Settings.tsx`) 真实接入：主题/语言/资料库路径等
- 所有设置保存到 SQLite，重启后恢复

### 5. 资料库服务
- `src/services/libraryService.ts`: 资料库 CRUD
- Python `backend/services/library_service.py`: libraries 表操作
- 首页统计数字从数据库真实查询

### 6. 状态栏实时数据
- `StatusBar.tsx` 从 dbService 查询真实数据
- 显示：资料库数量、已索引图片数

### 7. useServiceQuery Hook
- `src/stores/hooks.ts`: `useServiceQuery(serviceName, method, params?)`
  - 返回 `{ data, loading, error, refetch }`
  - 自动调用 `registry.ensureReady()` 启动服务
  - 支持 Tauri event 流式更新

## 禁止事项

- 不许删原有文件
- 不许用 mock 数据
- 不许 git commit/push
- 不许引入 UI 组件库

## 建议修改文件

```
src/services/registry.ts        # 新建
src/services/types.ts           # 新建
src/services/dbService.ts       # 新建
src/services/settingsService.ts # 新建
src/services/libraryService.ts  # 新建
src/stores/hooks.ts             # 新建
src/stores/atoms.ts             # 新建
src/components/shell/StatusBar.tsx  # 修改：真实数据
src/pages/Settings.tsx          # 修改：真实接入
src/pages/Home.tsx              # 修改：真实统计
src-tauri/src/main.rs           # 修改：添加 IPC commands + sidecar
src-tauri/tauri.conf.json       # 修改：sidecar 配置
backend/main.py                 # 新建
backend/db/schema.sql           # 新建
backend/db/connection.py        # 新建
backend/services/db_service.py   # 新建
backend/services/settings_service.py # 新建
backend/services/library_service.py # 新建
```

## 不要修改

- 原型 HTML/CSS/JS 文件
- `src/components/shared/` 共享组件
- `docs/` 文档

## 必须运行

```bash
npm run build      # TypeScript + Vite 构建通过
cargo build        # Rust 层编译通过
python backend/main.py  # Python 后端语法检查
```

## 验收标准

- ServiceRegistry 可注册/获取/启动服务
- 数据库可建表、插入、查询
- 设置页修改主题/语言后保存，重启保留
- StatusBar 显示真实资料库数量
- Home 页统计数字为真实查询结果
- 后端 Python 进程可启动并与前端通信
