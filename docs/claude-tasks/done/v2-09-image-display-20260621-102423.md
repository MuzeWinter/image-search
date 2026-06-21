# Claude Code 任务单：v2-09 — 搜索结果图片显示 + 端到端流程验证

遵守全部规则文件。

## 问题
Tauri 中前端无法直接用 `<img src="C:\path\to\file.jpg">` 显示本地图片。

## 必须实现
1. 添加 Tauri asset protocol 或 convertFileSrc 方案显示本地图片
2. 搜索结果卡片中的缩略图可显示
3. 修复 src-tauri/tauri.conf.json 添加 asset protocol 配置（如需要）
4. 搜索页 dropzone 样式完善（边框虚线、拖入高亮）
5. `npm run build` + `cargo build` 通过

## 实现方案
使用 Tauri v2 的 `convertFileSrc`：
```typescript
import { convertFileSrc } from "@tauri-apps/api/core";
<img src={convertFileSrc(imagePath)} />
```

在 tauri.conf.json 中确保 asset protocol 已启用：
```json
"app": { "security": { "assetProtocol": { "enable": true, "scope": ["**"] } } }
```

## 不执行 git commit/push
