# Claude Code 任务单：v2-102 — 最终集成验收测试

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
执行全栈集成验收测试，确保所有模块协同工作正常。

## 必须实现
1. 新增 `backend/tests/test_integration.py`：数据库 + 搜索 + UG + 扫描联合测试
2. 验证完整用户路径：添加资料库 → 扫描 → 索引 → 搜索 → 导出
3. 验证多资料库联合搜索
4. 验证增量索引（添加新文件后搜索能返回新结果）
5. 验证设置读写闭环（写入→重启模拟→读取一致）

## 不破坏
- 现有所有测试
- npm run check 全部 8 项 PASS
- CLI/API 接口

## 验收标准
- 集成测试全部通过
- npm run check 全部 PASS
- 不执行 git commit/push