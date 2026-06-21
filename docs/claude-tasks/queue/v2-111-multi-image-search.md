# Claude Code 任务单：v2-111 — 多图片批量搜索

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
支持一次拖入多张参考图同时搜索，结果聚合展示。

## 必须实现
1. 搜索页支持多文件拖放上传
2. 多张图片并行向量提取
3. 每张图独立搜索 + 结果合并去重
4. 搜索结果标注匹配来源图
5. 批量搜索结果导出

## 不破坏
- 现有单图搜索
- npm run check 全部 8 项 PASS

## 验收标准
- 拖入 3 张图同时搜索
- 结果合并去重正确
- npm run check 全部 PASS
- 不执行 git commit/push