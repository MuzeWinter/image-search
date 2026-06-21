# Claude Code 任务单：v2-62 — FAISS 索引增量更新优化

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
当前 FAISS 索引是全量重建，改为增量添加新向量，避免每次扫描都重建。

## 必须实现
- search_service.py 的 _index_single 已支持增量
- 确保 scan_service 扫描新文件后仅索引新增的向量
- 删除文件时从索引移除对应向量（当前需全量重建，改为标记删除）

## 验收标准
- 增量扫描后 FAISS 索引正常
- 搜索功能不受影响

## 不执行 git commit/push
