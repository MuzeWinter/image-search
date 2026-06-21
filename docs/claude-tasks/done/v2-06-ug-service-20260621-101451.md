# Claude Code 任务单：v2-06 — UG NXOpen 预览图提取 + 扫描集成

遵守全部规则文件。

## 目标
新建 ug_service.py，在扫描流程中添加 UG .prt 预览图提取阶段。

## ug_service.py
- 遍历目录找到所有 .prt 文件
- 用 NXOpen API 打开 .prt 导出预览图 (如 NXOpen 不可用则跳过并记录)
- SHA256 去重
- 写入 images 表 (source_type='ug-preview', ug_ref=文件名不含扩展名)
- 支持进度回调

## scan_service.py 修改
- 添加 UG 预览阶段 (在 Excel 阶段之后)
- 进度事件推送

## main.py
- 确保 ROUTES 正确

## 必须实现
1. `python backend/services/ug_service.py --path ./test-data` 可运行
2. `npm run build` 通过
3. 无 mock

## 不执行 git commit/push
