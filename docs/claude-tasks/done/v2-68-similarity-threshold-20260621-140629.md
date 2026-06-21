# Claude Code 任务单：v2-68 — 相似搜索阈值可配

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
设置页增加"最低相似度阈值"滑块，搜索结果只显示高于该阈值的项。

## 必须实现
- Settings 增加滑块：0% - 100%，默认 30%
- 保存到 localStorage
- Search.tsx 读取阈值过滤结果

## 验收标准
- `npm run build` 零错误
- 阈值 50% 时只显示 ≥50% 的结果

## 不执行 git commit/push
