# Claude Code 任务单：v2-82 — 自动化部署 CI 配置

遵守全部规则文件：AGENTS.md > CLAUDE.md > docs/AI-CODING-RULES.md

## 目标
创建 GitHub Actions CI 文件，每次推送自动执行构建验证。

## 必须实现
- `.github/workflows/ci.yml`
- Job: TypeScript check + Vite build + Cargo build + Python syntax
- Windows runner

## 验收标准
- CI 文件语法正确
- 推送后 Actions 可触发

## 不执行 git commit/push
