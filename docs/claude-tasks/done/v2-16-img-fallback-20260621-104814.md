# Claude Code 任务单：v2-16 — 图片显示容错与回退

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
增强图片显示容错：当图片文件不可访问时，显示占位图而非空白。

## 必须实现

### 1. Search.tsx 图片容错
- 搜索结果的缩略图 `<img>` 已有 `onError` 隐藏图片
- 需要补充：隐藏后显示占位图标/文字（如 "无预览"）
- 使用 CSS class 而非内联样式

### 2. 图片路径预处理
- 在 `fileToUrl()` 函数中增加路径存在性检查
- 文件不存在时返回 null，由调用方显示占位

### 3. 占位样式
- 创建 `.img-placeholder` CSS class
- 深色/浅色主题均适配
- 显示 "无预览" 图标或文字

## 验收标准
- `npm run build` 零错误
- 搜索结果显示正确（有图片的正常显示，无图片的显示占位）
- 深色/浅色主题下占位可读

## 不执行 git commit/push
