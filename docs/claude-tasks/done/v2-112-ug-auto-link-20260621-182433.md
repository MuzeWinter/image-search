# Claude Code 任务单：v2-112 — UG 文件自动关联定位

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
搜索到图片后自动定位同目录或关联的 UG .prt 文件。

## 必须实现
1. 搜索结果中自动检测同目录 .prt 文件
2. 搜索结果卡片显示 UG 文件关联状态
3. 关联 .prt 文件一键打开（用系统关联程序）
4. 支持反向查找：给定 .prt 文件找到搜索结果中的预览图

## 不破坏
- 现有搜索/索引功能
- npm run check 全部 8 项 PASS

## 验收标准
- 搜索结果能自动发现关联 .prt
- npm run check 全部 PASS
- 不执行 git commit/push