# Claude Code 任务单：v2-07 — i18n裁剪 + StatusBar + 最终构建

遵守全部规则文件。

## 目标
裁剪 i18n JSON 只保留 v2 需要的 key，更新 StatusBar，全量构建验证。

## 必须实现
1. zh.json / en.json — 只保留 sidebar/search/libraries/settings/theme/common/window/statusBar
2. StatusBar.tsx — 显示资料库数 + 图片数
3. `npm run build` 零错误
4. 确认所有删除后没有残留 import
5. 确认 Home.tsx 已不存在，首页直接是 Search

## 不执行 git commit/push
