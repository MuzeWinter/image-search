# Claude Code 任务单：013 — 项目最终整理

## 角色

遵守项目全部规则文件。

## 本次目标

项目工程化最终完善。

## 必须实现

### 1. .gitignore 完善
- 添加 `backend/data/*.db`（测试数据库不提交）
- 添加 `test-data/`（测试数据仅本地使用）
- 移除已提交的 `backend/data/zoobet.db`

### 2. 空目录处理
- `screens/` 目录添加 `.gitkeep`

### 3. README 更新
- 创建/更新 `README.md`：
  - 项目名称 ZOOBET检索
  - 一句话介绍
  - 技术栈
  - 快速开始（npm install + npm run tauri dev）
  - 项目结构简介

### 4. 代码自检
- 确保没有 console.log 残留（或仅保留错误日志）
- 确保没有未使用的 import

## 建议修改文件
- `.gitignore`
- `screens/.gitkeep`（新建）
- `README.md`（新建或修改）
- `git rm --cached backend/data/zoobet.db`

## 禁止事项
- 不许删功能代码
- 不许 git commit/push

## 验收标准
- `npm run build` 通过
- `.gitignore` 覆盖所有生成文件
