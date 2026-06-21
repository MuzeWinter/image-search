# Claude Code 任务单：Phase 4 — AI 图片搜索

## 角色

你是本项目的代码实现 Agent，遵守项目全部规则文件。

## 本次目标

实现 OpenCLIP + FAISS 图片向量搜索。用户拖入图片 → AI 提取特征 → 在资料库中搜索相似图片 → 返回结果列表。

## 当前已有基础

- 图片已索引到 SQLite images 表
- 服务注册中心已运行
- 搜索页面骨架 `pages/Search.tsx`

## 必须实现

### 1. AI 模型服务
- Python `backend/services/model_service.py`:
  - 加载 OpenCLIP ViT-B/32 模型
  - 图片预处理（resize/center-crop/normalize）
  - 特征向量提取
  - 模型加载进度回调
- 首次搜索时按需加载，非模态进度条

### 2. FAISS 索引服务
- Python `backend/services/search_service.py`:
  - 构建/更新 FAISS 索引
  - 向量搜索（top-K）
  - 查询图特征提取 → FAISS 搜索 → SQLite 反查元数据 → 组装结果
  - 自动关联 Excel/CAD/PDF 信息

### 3. 搜索页面
- 拖拽图片到搜索区
- 粘贴图片（Ctrl+V）
- 点击选择图片文件
- 搜索结果列表：缩略图、IMG 编号、相似度、来源类型、关联文件
- 点击结果：打开图片 / 打开关联 Excel / 打开关联 CAD / 复制路径

### 4. 图片库页面
- `pages/ImageLibrary.tsx`: 图片网格浏览
- 筛选：来源类型 / 标签 / 收藏
- 排序：时间 / 文件名 / 大小
- 批量操作：批量删除 / 批量添加标签

### 5. OCR（可选）
- 设置中可开启/关闭
- 搜索时对图片做 OCR 文字识别
- 文字结果用于辅助搜索

## 禁止事项

- 资料不上传云端
- 不许 git commit/push
- AI 模型加载不阻塞界面

## 验收标准

- 拖入图片 → 模型加载进度 → 搜索结果
- 搜索结果含 IMG 编号、相似度、来源类型
- Excel 来源显示 EX 编号和工作表
- CAD 来源显示 CAD 编号和路径
- 图片库可浏览/筛选/排序
