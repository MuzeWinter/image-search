# Claude Code 任务单：v2-20 — 扫描流程端到端验证脚本

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
创建并执行扫描流程端到端验证脚本，确认 Excel 图片提取 → 向量索引 → 数据库存储完整可用。

## 必须实现

### 1. 验证脚本 (backend/scripts/verify_scan_flow.py)
```python
# 模拟最小扫描流程
# 1. 连接数据库
# 2. 创建测试 library 记录
# 3. 如果存在测试 Excel 文件，解析并提取图片
# 4. 验证 images 表插入
# 5. 清理测试数据
```

### 2. 验证项
- `db.init` 初始化成功
- `library.add` 创建资料库成功
- Excel 解析不抛异常
- 图片记录写入 images 表
- 索引状态可查询

### 3. 集成到 CI
- 脚本退出码：0=成功，非0=失败
- 输出 JSON 结果

## 验收标准
- `python backend/scripts/verify_scan_flow.py` 退出码 0
- 不修改生产数据库（使用测试库或内存库）

## 不执行 git commit/push
