# Claude Code 任务单：v2-14 — 精简 i18n 未使用键

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
从 zh.json 和 en.json 中移除 42 个 v1 遗留的未使用 i18n 键，保持两份文件键完全一致。

## 必须实现

### 保留的键（代码中实际使用）
使用 `rg 't\("[^"]+"' src/ --no-filename -o` 提取所有实际使用的键。

### 待移除的未使用键（约 42 个）
包括：common.back, common.cancel, common.close, common.done, common.empty, common.failed, common.saved, common.start, common.success, search.copied, search.copyPath, search.device, search.imgId, search.modelFailed, search.modelProgress, search.modelReady, search.scopeAll, search.scopeExcelOnly, search.scopeUgOnly, search.searching, search.searchPlaceholder, 以及 sidebar.groups.*, window.* 等 v1 遗留键。

### 规则
- 两份文件必须保持完全相同的键结构
- 不删除任何代码中实际使用的键
- 保留 `common.loading`, `common.error`, `common.retry`, `common.save`, `common.delete`, `common.confirm`, `common.errorBoundaryTitle`, `common.errorBoundaryDesc`, `common.switchLocale`, `common.next`, `common.back`, `common.skip`, `common.start`, `common.success`, `common.failed`, `common.done`, `common.close`
- 保留所有 `sidebar.*`, `theme.*`, `settings.*`, `search.*`, `libraries.*`, `welcome.*`, `statusBar.*` 中实际使用的键

## 验收标准
- `npm run build` 零错误
- `python -c "import json; json.load(open('src/i18n/zh.json')); json.load(open('src/i18n/en.json')); print('OK')"` 通过

## 不执行 git commit/push
