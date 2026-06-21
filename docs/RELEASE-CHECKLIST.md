# ZOOBET 智能检索 — 发布检查清单

> 基于 v2-110 项目发布就绪最终验证生成

---

## 1. 构建与质量门禁

- [x] `npm run check` 全部 8 项 PASS（v2-110 初验通过，v2-115 终验复验通过）
  - [x] tsc --noEmit（TypeScript 类型检查）
  - [x] eslint（代码规范，0 warnings）
  - [x] vite build（前端生产构建）
  - [x] cargo build（Rust 后端编译）
  - [x] python syntax（Python 语法检查）
  - [x] mypy（Python 类型检查，16 files no issues）
  - [x] pytest（Python 后端测试，120 passed）
  - [x] vitest（前端测试，20 passed，3 test files）
- [x] 无构建错误
- [x] eslint 0 warnings（v2-110 曾有 1 个 react-hooks/exhaustive-deps warning，v2-115 已消除）
- [x] `npm run build:release` 生产构建通过（Rust release binary 11.64 MB，MSI/NSIS 因运行中 exe 锁定未打包）

---

## 2. 测试覆盖

- [x] pytest：120 测试全部通过
  - [x] 数据库服务 (db_service)：15 tests
  - [x] 集成测试 (integration)：37 tests
  - [x] 资料库服务 (library_service)：12 tests
  - [x] 搜索端到端 (search_e2e)：17 tests
  - [x] 搜索服务 (search_service)：14 tests
  - [x] UG 服务 (ug_service)：25 tests
- [x] vitest：3 测试文件，20 tests 全部通过
- [x] 全栈联合测试覆盖（前端→后端→Python→Rust）

---

## 3. 版本完整性

- [x] 总提交数：125 commits
- [x] v2-01 至 v2-110 全部版本完成
- [x] 121 个 done 任务文档
- [x] CHANGELOG.md 覆盖 v2-01 至 v2-110
- [x] 提交信息规范、可追溯
- [ ] v2-98 done 文件缺失（代码已合入，需补充任务记录）

---

## 4. 文档完整性

- [x] README.md：项目介绍、安装、使用
- [x] USER-GUIDE.md：用户操作指南
- [x] DEV-GUIDE.md：开发指南
- [x] FEATURES.md：功能清单
- [x] CHANGELOG.md：版本变更记录
- [x] RELEASE-CHECKLIST.md：本文件
- [x] AI-CODING-RULES.md：AI 编程规则
- [x] docs/claude-tasks/：121 done 任务文档

---

## 5. 核心功能闭环验证

### 搜索流程
- [x] 添加资料库 → 扫描 → 建立索引 → 搜索 → 结果展示
- [x] 图文搜索、以图搜图
- [x] 相似度阈值过滤
- [x] 排序（相似度/文件名/UG 图号）
- [x] 网格/列表视图切换
- [x] 分页、虚拟滚动
- [x] 搜索结果导出（ZIP/PDF/剪贴板）

### 资料库管理
- [x] 添加/删除资料库
- [x] 扫描设置持久化
- [x] 多资料库搜索
- [x] 文件夹监控自动增量扫描
- [x] UG NXOpen 批量提取（断点续扫/超时保护）

### 搜索增强
- [x] 收藏功能，持久化保存
- [x] 搜索历史（最近 20 条）
- [x] 全局搜索弹窗 (Ctrl+Shift+F)
- [x] 图片对比（双图分屏）
- [x] 悬停预览
- [x] 详情面板

### 设置与偏好
- [x] 主题切换（浅色/深色/跟随系统）— 保存重启有效
- [x] 语言切换（中文/英文）— 保存重启有效
- [x] 窗口尺寸记忆 — 保存重启有效
- [x] 强调色选择器
- [x] 快捷键帮助面板 (Ctrl+/)

### 系统功能
- [x] 最小化到系统托盘
- [x] 启动画面
- [x] 自动备份（退出时备份数据库）
- [x] 系统诊断面板
- [x] 活动日志查看器
- [x] 错误边界与崩溃恢复
- [x] 数据库维护（VACUUM/ANALYZE/REINDEX）

---

## 6. 平台兼容性

- [x] Windows 11 构建通过
- [x] Windows 中文路径可用
- [x] Windows 空格路径可用
- [x] Tauri v2 原生窗口
- [x] Python JSON-RPC sidecar 通信

---

## 7. 性能

- [x] 代码分割（React lazy + Suspense）
- [x] 图片懒加载（IntersectionObserver）
- [x] Python 后端延迟初始化
- [x] 启动时间优化
- [x] 万级图片索引性能验证
- [x] FAISS 增量索引更新

---

## 8. 无障碍

- [x] aria-label 属性覆盖
- [x] 键盘导航（Tab/箭头/Enter）
- [x] focus-visible 焦点可见样式

---

## 9. CI/CD

- [x] GitHub Actions CI 流水线
- [x] vitest 前端测试集成
- [x] cargo clippy 检查集成
- [x] Rust test 集成
- [x] CI 缓存优化

---

## 10. 待处理事项

| 项目 | 状态 | 说明 |
|------|------|------|
| v2-98 done 文件 | 缺失 | 搜索结果导出与分享任务记录未归档 |
| eslint warning | ✅ 已解决 | v2-115 eslint 0 warnings |
| 端到端实测 | ✅ 已确认 | v2-115 npm run check 8/8 PASS，120 pytest + 20 vitest 全部通过 |

---

## 11. v2-115 最终全量质量验证 (2026-06-21)

| 检查项 | 状态 | 详情 |
|--------|------|------|
| npm run check (8/8) | ✅ PASS | tsc, eslint(0w), vite build, cargo build, python syntax, mypy(16f), pytest(120), vitest(20) |
| npm run build:release | ✅ PASS | Rust release binary 11.64 MB |
| i18n 翻译完整性 | ✅ PASS | 365 keys zh-CN = 365 keys en-US，0 缺失 |
| 按钮事件绑定 | ✅ PASS | 116 buttons 全部有 onClick，13 inputs 全部有 handler，1 select 有 onChange |
| 所有测试 | ✅ PASS | 120 pytest + 20 vitest = 140 passed |
| Git commit/push | ⛔ 已跳过 | 任务要求不执行 |

---

## 结论

**项目 v2-115 最终全量质量验证通过。**

- 质量门禁：8/8 PASS（连续两次验证：v2-110 + v2-115）
- 测试覆盖：140 tests (120 pytest + 20 vitest)，全部通过
- i18n 完整性：365 zh-CN = 365 en-US，0 缺失
- 交互完整性：116 buttons / 13 inputs / 1 select 全部绑定事件处理器
- eslint：0 warnings（此前 1 个 warning 已修复）
- mypy：16 source files，0 issues
- 版本完整性：v2-01 至 v2-115 共 115 版本
- 发布构建：Rust release binary 编译通过（MSI/NSIS 打包需关闭运行中实例后重试）
- 文档：齐全（README / USER-GUIDE / DEV-GUIDE / FEATURES / CHANGELOG / 本清单）
