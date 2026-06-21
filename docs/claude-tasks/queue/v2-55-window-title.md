# Claude Code 任务单：v2-55 — 窗口标题显示当前资料库名

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
窗口标题动态显示：`ZOOBET — [当前页/资料库名]`，搜索时显示搜索状态。

## 必须实现
- Header 或 AppShell 使用 document.title 动态更新
- 搜索页：`ZOOBET 检索 — 图片搜索`
- 资料库：`ZOOBET 检索 — 资料库`
- 设置：`ZOOBET 检索 — 设置`
- 扫描中：`[扫描中] ZOOBET 检索 — 资料库`

## 验收标准
- `npm run build` 零错误
- 切换页面标题更新
- 中英文语言时标题相应切换

## 不执行 git commit/push
