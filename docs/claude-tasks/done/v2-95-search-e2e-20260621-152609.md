# Claude Code 任务单：v2-95 — 搜索端到端质量验证

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
验证 CLIP+FAISS 图像搜索管线端到端质量，确保搜索返回结果正确、相似度排序合理。

## 必须实现
1. 在 `backend/tests/` 新增 `test_search_e2e.py`，创建测试用 fixture 图片集（至少 5 张不同类别的测试图片）
2. 验证：索引构建 → 向量提取 → FAISS 搜索 → 结果排序 全链路
3. 验证相似度分数单调性（同图搜索返回自己时相似度最高）
4. 验证搜索 scope 过滤器正确生效
5. 验证空索引优雅处理
6. 验证大规模结果截断（top_k）正确

## 不破坏
- 现有 42 个 pytest 全部通过
- 现有 20 个 vitest 全部通过
- CLI/API 接口不变

## 验收标准
- `npm run check` 全部 8 项 PASS
- 新增测试全部通过
- 不执行 git commit/push