# Claude Code 任务单：v2-53 — 多资料库同时搜索支持

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索页支持选择搜索范围：全部资料库 或 指定单个资料库。

## 必须实现
- Search.tsx 搜索范围增加资料库选择器
- "全部" + 各资料库名称
- 后端 search_service 支持 library_id 参数过滤

## 验收标准
- `npm run build` 零错误
- 选择特定资料库后只返回该库结果

## 不执行 git commit/push
