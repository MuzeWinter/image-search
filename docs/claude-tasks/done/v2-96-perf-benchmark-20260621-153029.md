# Claude Code 任务单：v2-96 — 索引性能基准测试

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
验证系统在万级图片索引下的性能，确保 10 年图纸量级不卡顿。

## 必须实现
1. 在 `backend/tests/` 新增 `test_perf_benchmark.py`
2. 生成合成测试数据：1000/5000/10000 张模拟图片（随机 numpy 数组）
3. 测量 CLIP 向量化吞吐（每秒处理图片数）
4. 测量 FAISS 索引构建耗时
5. 测量搜索响应时间（100/1000/5000/10000 索引规模下的 top-10 搜索）
6. 输出性能报告到 `backend/tests/perf_results/` 目录便于追踪

## 不破坏
- 现有 42+ pytest 全部通过（不含性能测试，性能测试独立运行）
- 现有 20 vitest 全部通过
- CLI/API 接口不变
- npm run check 全部 8 项 PASS

## 验收标准
- `python -m pytest backend/tests/test_perf_benchmark.py -v` 全部通过
- `npm run check` 全部 8 项 PASS
- 不执行 git commit/push