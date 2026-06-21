# Claude Code 任务单：v2-02 — 裁剪类型+路由 12→3 页面

遵守全部规则文件。

## 目标
重写 types.ts 只保留 v2 需要的类型，App.tsx 路由从 12 页砍到 3 页，Sidebar 导航从 12 项砍到 3 项。

## 必须实现
1. `src/services/types.ts` — 只保留: ServiceDescriptor, Library, ImageRecord, SearchResult, ScanProgress, SystemStats
2. `src/App.tsx` — lazy import 只保留 Search/Libraries/Settings 三个页面
3. `src/components/shell/Sidebar.tsx` — navItems 只保留 3 项 (search→"/", libraries→"/libraries", settings→"/settings")
4. `npm run build` 零错误

## 不要修改
- Shell 组件、主题/i18n、Tauri 配置
- 不删除页面文件（下个任务删）

## 不执行 git commit/push
