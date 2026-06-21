# Claude Code 任务单：v2-24 — 启动时自动检测新文件

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
应用启动时自动检测资料库中新增/修改/删除的文件，增量更新索引。

## 必须实现

### 1. 后端 (scan_service.py)
- 新增 `scan.check_changes(library_id)` 方法
- 对比文件哈希，返回新增/修改/删除列表
- 不阻塞 UI 线程

### 2. 前端
- App.tsx 启动时调用 check_changes
- 如有变更，StatusBar 显示变更数量
- 用户可点击手动触发增量扫描

### 3. 验收标准
- `npm run build` 零错误
- 新增文件被检测到
- 不重复扫描已索引文件
- 不影响启动速度

## 不执行 git commit/push
