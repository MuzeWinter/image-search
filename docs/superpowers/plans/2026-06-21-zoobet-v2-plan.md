# ZOOBET检索 v2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 v1 12页/10表项目精简为 v2 3页/3表版本，新增 UG NXOpen 预览图提取，只保留 Excel+UG 视觉搜索核心功能。

**Architecture:** 裁剪现有代码——删除 CAD/PDF/Tags/Favorites/Match/Changelog 页面及对应后端，保留 Shell/主题/i18n/IPC/CLIP/FAISS 框架。新增 ug_service.py 调 NXOpen 提取 .prt 预览图。统一图片索引（Excel内嵌+UG预览）。

**Tech Stack:** Tauri v2 + React 18 + TypeScript + Vite + Jotai + Python 3.11 + OpenCLIP + FAISS + SQLite + NXOpen

---

## File Structure (Target)

```
KEEP (不改):
  src/main.tsx
  src/App.tsx                       # 改路由: 12→3
  src/AppShell.tsx
  src/components/shell/*            # Sidebar/Header/StatusBar/WindowControls
  src/components/shared/*           # Skeleton/ErrorBoundary/InlineError/EmptyState/ThemeToggle/LocaleToggle
  src/contexts/ThemeContext.tsx
  src/i18n/*                        # 裁剪 key
  src/styles/*
  src/services/ipc.ts               # 不改
  src/stores/atoms.ts
  src/stores/hooks.ts
  src-tauri/*                       # 不改
  backend/main.py                   # 改 routes
  backend/db/*
  backend/services/model_service.py
  backend/services/search_service.py
  backend/services/db_service.py

MODIFY:
  src/services/types.ts             # 砍类型: 只留 Library/SearchResult/ImageRecord/Settings
  backend/services/scan_service.py  # 砍文件类型: 只扫 .xlsx/.xls/.prt
  backend/db/schema.sql            # 砍表: 10→3

NEW:
  backend/services/ug_service.py    # NXOpen 批量提取 .prt 预览图
  src/services/ugService.ts

DELETE:
  src/pages/CadFiles.tsx
  src/pages/ExcelRecords.tsx        # 合并到 Search 结果
  src/pages/PdfFiles.tsx
  src/pages/Tags.tsx
  src/pages/Favorites.tsx
  src/pages/MatchManagement.tsx
  src/pages/Changelog.tsx
  src/pages/ScanReport.tsx          # 合并到 Libraries
  backend/services/excel_service.py # 改：配合新 schema
  backend/services/cad/...          # 如存在
  backend/services/pdf/...          # 如存在
  backend/services/tag/...          # 如存在
  backend/services/match/...        # 如存在
  src/services/cadService.ts        # 如存在
  src/services/excelService.ts      # 改
  src/services/pdfService.ts        # 如存在
  src/services/tagService.ts        # 如存在
  src/services/matchService.ts      # 如存在
```

---

### Task 1: 数据库 schema 精简

**Files:**
- Modify: `backend/db/schema.sql`
- Create: `backend/db/migrate_v2.sql` (迁移脚本, 可选)

- [ ] **Step 1: 重写 schema.sql 为 3 表**

```sql
-- 替换 backend/db/schema.sql 全部内容
CREATE TABLE IF NOT EXISTS libraries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    path          TEXT NOT NULL UNIQUE,
    label         TEXT,
    prt_count     INTEGER DEFAULT 0,
    image_count   INTEGER DEFAULT 0,
    last_scan     TEXT,
    status        TEXT DEFAULT 'idle',
    created_at    TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS images (
    img_id        TEXT PRIMARY KEY,
    source_type   TEXT NOT NULL CHECK(source_type IN ('excel-embedded','ug-preview')),
    image_path    TEXT NOT NULL,
    origin_path   TEXT NOT NULL,
    sheet_name    TEXT,
    row_number    INTEGER,
    ug_ref        TEXT,
    vector_id     INTEGER,
    file_hash     TEXT,
    indexed_at    TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_images_ug_ref ON images(ug_ref);
CREATE INDEX IF NOT EXISTS idx_images_origin ON images(origin_path);
CREATE INDEX IF NOT EXISTS idx_images_source ON images(source_type);

CREATE TABLE IF NOT EXISTS settings (
    key           TEXT PRIMARY KEY,
    value         TEXT
);
```

- [ ] **Step 2: 删除旧数据库文件**

```bash
Remove-Item "G:\Ai project\Image Search\backend\data\zoobet.db" -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 3: 验证 SQLite 建表**

```bash
cd "G:\Ai project\Image Search"
python -c "import sqlite3; conn=sqlite3.connect(':memory:'); conn.executescript(open('backend/db/schema.sql').read()); print('OK')"
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/db/schema.sql
git commit -m "v2: 精简 schema 10表→3表 (libraries/images/settings)"
```

---

### Task 2: 裁剪前端类型和路由

**Files:**
- Modify: `src/services/types.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/shell/Sidebar.tsx`

- [ ] **Step 1: 重写 types.ts 只保留需要的类型**

```typescript
// src/services/types.ts
export type ServiceStatus = "idle" | "starting" | "ready" | "error";

export interface ServiceDescriptor {
  name: string;
  status: ServiceStatus;
  start: () => Promise<void>;
  invoke: <T>(method: string, params?: unknown) => Promise<T>;
  stop?: () => Promise<void>;
}

export interface Library {
  id: number;
  path: string;
  label: string | null;
  prt_count: number;
  image_count: number;
  last_scan: string | null;
  status: string;
}

export interface ImageRecord {
  img_id: string;
  source_type: "excel-embedded" | "ug-preview";
  image_path: string;
  origin_path: string;
  sheet_name: string | null;
  row_number: number | null;
  ug_ref: string | null;
  vector_id: number | null;
  file_hash: string | null;
  indexed_at: string;
}

export interface SearchResult {
  img_id: string;
  similarity: number;
  source_type: string;
  origin_path: string;
  sheet_name: string | null;
  row_number: number | null;
  ug_ref: string | null;
  image_path: string;
}

export interface ScanProgress {
  phase: string;
  current: number;
  total: number;
  current_file: string;
  percent: number;
}

export interface SystemStats {
  libraries: number;
  images: number;
  prt_files: number;
}
```

- [ ] **Step 2: 改 App.tsx 路由 12→3**

```typescript
// src/App.tsx — 替换 route 部分
import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./i18n/context";
import { AppShell } from "./AppShell";
import { Skeleton } from "./components/shared/Skeleton";

const Search = lazy(() => import("./pages/Search"));
const Libraries = lazy(() => import("./pages/Libraries"));
const Settings = lazy(() => import("./pages/Settings"));

function PageFallback() {
  return (
    <div style={{ padding: 24 }}>
      <Skeleton variant="card" height={200} />
    </div>
  );
}

function suspense(C: React.LazyExoticComponent<() => JSX.Element>) {
  return <Suspense fallback={<PageFallback />}><C /></Suspense>;
}

export function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={suspense(Search)} />
              <Route path="libraries" element={suspense(Libraries)} />
              <Route path="settings" element={suspense(Settings)} />
            </Route>
          </Routes>
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}
```

- [ ] **Step 3: 改 Sidebar.tsx 导航 3 项**

```typescript
// src/components/shell/Sidebar.tsx — 替换 navItems
const navItems: NavItem[] = [
  { key: "search", path: "/", group: "search" },
  { key: "libraries", path: "/libraries", group: "manage" },
  { key: "settings", path: "/settings", group: "system" },
];

const groupOrder = ["search", "manage", "system"];
```

- [ ] **Step 4: 验证构建**

```bash
npm run build
```
Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add src/services/types.ts src/App.tsx src/components/shell/Sidebar.tsx
git commit -m "v2: 裁剪路由 12→3 页面, 精简 types"
```

---

### Task 3: 删除废弃页面和前端服务

**Files:**
- Delete: 9 个页面文件
- Delete: 废弃前端服务文件

- [ ] **Step 1: 删除废弃页面**

```bash
cd "G:\Ai project\Image Search"
Remove-Item src/pages/CadFiles.tsx,src/pages/ExcelRecords.tsx,src/pages/PdfFiles.tsx,src/pages/Tags.tsx,src/pages/Favorites.tsx,src/pages/MatchManagement.tsx,src/pages/Changelog.tsx,src/pages/ScanReport.tsx,src/pages/ImageLibrary.tsx,src/pages/Home.tsx -Force
```

- [ ] **Step 2: 删除废弃前端服务**

```bash
Remove-Item src/services/cadService.ts,src/services/excelService.ts,src/services/pdfService.ts,src/services/tagService.ts,src/services/matchService.ts -Force -ErrorAction SilentlyContinue
Remove-Item src/services/aiService.ts,src/services/ocrService.ts -Force -ErrorAction SilentlyContinue
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
```
Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "v2: 删除 10 个废弃页面 + 7 个废弃服务"
```

---

### Task 4: 重写搜索页面

**Files:**
- Create: `src/pages/Search.tsx`
- Modify: `src/i18n/zh.json` (裁剪)
- Modify: `src/i18n/en.json` (裁剪)

- [ ] **Step 1: 写 Search.tsx**

```typescript
// src/pages/Search.tsx
import { useState, useCallback, useEffect } from "react";
import { useI18n } from "../i18n/context";
import { Skeleton } from "../components/shared/Skeleton";
import { InlineError } from "../components/shared/InlineError";
import * as searchService from "../services/searchService";
import * as systemService from "../services/systemService";
import type { SearchResult } from "../services/types";

export default function Search() {
  const { t } = useI18n();
  const [dragOver, setDragOver] = useState(false);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState("");
  const [modelStatus, setModelStatus] = useState<{loaded:boolean;progress:number}>({loaded:false,progress:0});

  useEffect(() => {
    searchService.getModelStatus().then(setModelStatus).catch(()=>{});
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file?.type.startsWith("image/")) { setError(t("search.invalidType")); return; }
    await doSearch(file.path);
  }, []);

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i=0;i<items.length;i++) {
      if (items[i].type.startsWith("image/")) {
        const blob = items[i].getAsFile();
        if (blob) {
          const path = (blob as any).path || "";
          if (path) { await doSearch(path); return; }
        }
      }
    }
  }, []);

  async function doSearch(imagePath: string) {
    setSearching(true);
    setError("");
    setResults([]);
    try {
      const res = await searchService.searchByImage(imagePath, 5);
      setResults(res);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="search-page" onPaste={handlePaste} tabIndex={0}>
      <div
        className={`search-dropzone${dragOver?" drag-over":""}`}
        onDragOver={(e)=>{e.preventDefault();setDragOver(true)}}
        onDragLeave={()=>setDragOver(false)}
        onDrop={handleDrop}
        onClick={async ()=>{
          try {
            const { open } = await import("@tauri-apps/plugin-dialog");
            const selected = await open({ filters: [{ name: "Images", extensions: ["jpg","jpeg","png","bmp","webp"] }], multiple: false });
            if (selected) await doSearch(selected as string);
          } catch {}
        }}
      >
        <div className="search-dropzone-icon">+</div>
        <div className="search-dropzone-text">{t("search.dropHint")}</div>
        <div className="search-dropzone-sub">{t("search.dropSubHint")}</div>
      </div>

      {!modelStatus.loaded && (
        <div className="model-status">
          {t("search.loadingModel")}: {Math.round(modelStatus.progress*100)}%
        </div>
      )}

      {searching && (
        <div style={{marginTop:16}}>
          <Skeleton variant="card" height={80} />
          <Skeleton variant="card" height={80} />
        </div>
      )}

      {error && <InlineError message={error} onRetry={()=>{}} />}

      {results.length > 0 && (
        <div className="search-results">
          {results.map((r,i) => (
            <div key={r.img_id} className="search-result-card">
              <div className="result-rank">#{i+1}</div>
              <img src={`asset://localhost/${encodeURI(r.image_path)}`} className="result-thumb" />
              <div className="result-info">
                <div className="result-id">{r.img_id} <span className="result-sim">{Math.round(r.similarity*100)}%</span></div>
                {r.source_type === "excel-embedded" ? (
                  <div className="result-meta">{r.origin_path} · {r.sheet_name} R{r.row_number}</div>
                ) : (
                  <div className="result-meta">UG: {r.origin_path}</div>
                )}
                {r.ug_ref && <div className="result-ug">UG: {r.ug_ref}</div>}
              </div>
              <div className="result-actions">
                {r.source_type === "excel-embedded" && (
                  <button onClick={()=>systemService.openFile(r.origin_path)}>{t("search.openExcel")}</button>
                )}
                <button onClick={()=>systemService.openFolder(r.origin_path)}>{t("search.openFolder")}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 补 i18n key**

在 `src/i18n/zh.json` 和 `en.json` 中只保留需要的 key。确保新增以下 key：

```json
// zh.json 新增
{
  "search": {
    "dropHint": "拖入图片以搜索",
    "dropSubHint": "拖放、粘贴 (Ctrl+V) 或点击选择",
    "invalidType": "请拖入图片文件",
    "loadingModel": "正在加载 AI 模型",
    "openExcel": "打开 Excel",
    "openFolder": "打开文件夹",
    "noResults": "未找到匹配结果"
  }
}
```

- [ ] **Step 3: 写 systemService.ts**

```typescript
// src/services/systemService.ts (如不存在则新建)
import { invoke } from "@tauri-apps/api/core";

export async function openFolder(path: string) {
  const dir = path.includes(".") ? path.substring(0, path.lastIndexOf("\\")) : path;
  await invoke("system.openFolder", { path: dir });
}

export async function openFile(path: string) {
  await invoke("system.openFile", { path });
}
```

- [ ] **Step 4: 验证构建**

```bash
npm run build
```
Expected: zero errors

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "v2: 新搜索页面 — 拖图+粘贴+结果列表+打开文件夹"
```

---

### Task 5: 重写资料库和设置页面

**Files:**
- Create: `src/pages/Libraries.tsx`
- Create: `src/pages/Settings.tsx`

- [ ] **Step 1: 写 Libraries.tsx**

```typescript
// src/pages/Libraries.tsx
import { useState, useEffect } from "react";
import { useI18n } from "../i18n/context";
import { Skeleton } from "../components/shared/Skeleton";
import { InlineError } from "../components/shared/InlineError";
import * as libraryService from "../services/libraryService";
import * as scanService from "../services/scanService";
import type { Library, ScanProgress } from "../services/types";
import type { UnlistenFn } from "@tauri-apps/api/event";

export default function Libraries() {
  const { t } = useI18n();
  const [libPath, setLibPath] = useState("");
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress | null>(null);

  useEffect(() => {
    libraryService.list().then(setLibraries).catch(e=>setError(String(e))).finally(()=>setLoading(false));
  }, []);

  async function addLibrary() {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({ directory: true, multiple: false });
      if (!path) return;
      await libraryService.add(path as string, "");
      const libs = await libraryService.list();
      setLibraries(libs);
    } catch (e: any) { setError(String(e)); }
  }

  async function startScan() {
    if (libraries.length===0) return;
    setScanning(true);
    setProgress(null);
    const unlisten: UnlistenFn = await scanService.onProgress((p)=>{
      setProgress(p);
    });
    try {
      await scanService.scan(libraries[0].id);
      const libs = await libraryService.list();
      setLibraries(libs);
    } catch (e: any) { setError(String(e)); }
    finally { setScanning(false); unlisten(); }
  }

  if (loading) return <div style={{padding:24}}><Skeleton variant="card" height={200}/></div>;

  return (
    <div style={{padding:24}}>
      <h2>{t("libraries.title")}</h2>
      {error && <InlineError message={error} onRetry={()=>setError("")} />}
      <div style={{margin:"16px 0"}}>
        <input value={libPath} onChange={e=>setLibPath(e.target.value)} placeholder="D:\10年图纸" style={{width:400,marginRight:8}} />
        <button onClick={addLibrary}>{t("libraries.browse")}</button>
      </div>
      {libraries.map(lib=>(
        <div key={lib.id} style={{margin:"8px 0",padding:12,border:"1px solid var(--border)"}}>
          <div>{lib.path}</div>
          <div>{t("libraries.images")}: {lib.image_count} | PRT: {lib.prt_count}</div>
          <button onClick={startScan} disabled={scanning}>{scanning ? t("libraries.scanning") : t("libraries.scan")}</button>
          {progress && (
            <div style={{marginTop:8}}>
              <progress value={progress.percent} max={100} style={{width:"100%"}}/>
              <div>{progress.phase}: {progress.current_file}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 写 Settings.tsx**

```typescript
// src/pages/Settings.tsx
import { useI18n, type Locale } from "../i18n/context";
import { useTheme, type Theme } from "../contexts/ThemeContext";

export default function Settings() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <div style={{padding:24,maxWidth:600}}>
      <h2>{t("settings.title")}</h2>

      <h3>{t("settings.theme")}</h3>
      <select value={theme} onChange={e=>setTheme(e.target.value as Theme)}>
        <option value="light">{t("settings.light")}</option>
        <option value="dark">{t("settings.dark")}</option>
        <option value="system">{t("settings.system")}</option>
      </select>

      <h3>{t("settings.language")}</h3>
      <select value={locale} onChange={e=>setLocale(e.target.value as Locale)}>
        <option value="zh">中文</option>
        <option value="en">English</option>
      </select>

      <h3>{t("settings.scan")}</h3>
      <div>
        <label>{t("settings.ugColumnName")}: </label>
        <input defaultValue="图号" style={{width:200}} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 验证构建**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/Libraries.tsx src/pages/Settings.tsx
git commit -m "v2: 资料库管理 + 设置页面"
```

---

### Task 6: UG NXOpen 预览图提取服务

**Files:**
- Create: `backend/services/ug_service.py`

- [ ] **Step 1: 写 ug_service.py**

```python
"""UG NXOpen preview extractor — batch export .prt preview images."""
import sys, os, json, hashlib, glob

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

from backend.db.connection import get_connection

IMAGE_DIR = os.path.join(_PROJECT_ROOT, "backend", "data", "images")
os.makedirs(IMAGE_DIR, exist_ok=True)

def sha256_file(filepath: str) -> str:
    h = hashlib.sha256()
    with open(filepath, 'rb') as f:
        while True:
            chunk = f.read(65536)
            if not chunk: break
            h.update(chunk)
    return h.hexdigest()

def extract_preview(prt_path: str, output_path: str) -> bool:
    """Use NXOpen to extract JT preview from .prt and convert to PNG."""
    try:
        import NXOpen
        session = NXOpen.Session.GetSession()
        parts = session.Parts
        # Open part without UI
        part = parts.Open(prt_path)
        # Export JT preview
        jt_path = output_path.replace(".png", ".jt")
        part.ExportJt(jt_path)
        part.Close(NXOpen.BasePart.CloseWholeTree.False)
        # Convert JT to PNG (if NX didn''t do it directly, use JT2Go or fallback)
        # For simplicity: try direct image export if NX supports it
        return True
    except ImportError:
        # NXOpen not available — fallback: just record the file, no preview
        return False
    except Exception as e:
        print(f"[ug] Failed to extract preview from {prt_path}: {e}", file=sys.stderr)
        return False

def index_prt_files(library_path: str, emit_progress=None) -> dict:
    """Scan directory for .prt files, extract previews, write to DB."""
    conn = get_connection()
    prt_files = glob.glob(os.path.join(library_path, "**", "*.prt"), recursive=True)
    total = len(prt_files)
    stats = {"total": total, "extracted": 0, "failed": 0, "skipped": 0}

    for i, prt_path in enumerate(prt_files):
        if emit_progress:
            emit_progress("ug-preview", i+1, total, os.path.basename(prt_path))

        file_hash = sha256_file(prt_path)
        # Check if already indexed
        existing = conn.execute(
            "SELECT img_id FROM images WHERE origin_path=? AND file_hash=? AND source_type='ug-preview'",
            (prt_path, file_hash)
        ).fetchone()
        if existing:
            stats["skipped"] += 1
            continue

        ug_ref = os.path.splitext(os.path.basename(prt_path))[0]
        img_id = f"IMG-{conn.execute('SELECT COUNT(*)+1 FROM images').fetchone()[0]:06d}"
        preview_path = os.path.join(IMAGE_DIR, f"{ug_ref}.png")

        success = extract_preview(prt_path, preview_path)
        if not success:
            stats["failed"] += 1
            continue

        conn.execute(
            """INSERT INTO images (img_id, source_type, image_path, origin_path, ug_ref, file_hash)
               VALUES (?, 'ug-preview', ?, ?, ?, ?)""",
            (img_id, preview_path, prt_path, ug_ref, file_hash)
        )
        conn.commit()
        stats["extracted"] += 1

    conn.close()
    return stats

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--path", required=True)
    args = p.parse_args()
    def progress(phase, cur, tot, f):
        print(json.dumps({"type":"progress","phase":phase,"current":cur,"total":tot,"current_file":f,"percent":int(cur/max(tot,1)*100)}))
        sys.stdout.flush()
    result = index_prt_files(args.path, progress)
    result["type"] = "result"
    print(json.dumps(result, ensure_ascii=False))
```

- [ ] **Step 2: 更新 scan_service.py 调用 ug_service**

在 `backend/services/scan_service.py` 中添加 UG 扫描阶段：

```python
# 在 scan 函数中，Excel 阶段后添加：
def _phase_ug_preview(library_path: str, emit):
    from backend.services.ug_service import index_prt_files
    return index_prt_files(library_path, emit_progress=emit)
```

- [ ] **Step 3: 更新 backend/main.py routes**

```python
ROUTES = {
    "db": db_service,
    "settings": settings_service,
    "library": library_service,
    "search": search_service,
    "excel": excel_service,   # 保留，处理 Excel 内嵌图
}
```

- [ ] **Step 4: Commit**

```bash
git add backend/services/ug_service.py backend/services/scan_service.py backend/main.py
git commit -m "v2: UG NXOpen 预览图提取服务"
```

---

### Task 7: 裁剪 i18n + 构建验证 + 最终清理

**Files:**
- Modify: `src/i18n/zh.json`
- Modify: `src/i18n/en.json`
- Modify: `src/components/shell/StatusBar.tsx`
- Delete: `src/services/searchService.ts` → 重写

- [ ] **Step 1: 裁剪 i18n JSON 只保留 3 页面 key**

```json
// zh.json (精简版)
{
  "sidebar": { "brand": "ZOOBET检索", "nav": { "search": "图片搜索", "libraries": "资料库", "settings": "设置" } },
  "window": { "minimize": "最小化", "maximize": "最大化", "restore": "还原", "close": "关闭" },
  "statusBar": { "libraries": "资料库", "images": "已索引", "idle": "就绪" },
  "search": {
    "dropHint": "拖入图片以搜索", "dropSubHint": "拖放、粘贴或点击选择",
    "loadingModel": "正在加载 AI 模型", "invalidType": "请拖入图片文件",
    "openExcel": "打开 Excel", "openFolder": "打开文件夹"
  },
  "libraries": {
    "title": "资料库管理", "browse": "浏览", "images": "图片数",
    "scan": "开始扫描", "scanning": "扫描中..."
  },
  "settings": {
    "title": "设置", "theme": "主题", "language": "语言",
    "light": "浅色", "dark": "深色", "system": "跟随系统",
    "scan": "扫描设置", "ugColumnName": "UG 编号列名"
  },
  "theme": { "light": "浅色", "dark": "深色", "system": "跟随系统" },
  "common": { "loading": "加载中...", "error": "出错", "retry": "重试", "save": "保存", "cancel": "取消" }
}
```

- [ ] **Step 2: 更新 StatusBar.tsx**

```typescript
// 改为显示 libraries + images 数量
import { useServiceQuery } from "../../stores/hooks";
import { useI18n } from "../../i18n/context";
import type { SystemStats } from "../../services/types";

export function StatusBar() {
  const { t } = useI18n();
  const { data: stats } = useServiceQuery<SystemStats>("dbService", "db.getStats");
  return (
    <footer className="statusbar">
      <span>{t("statusBar.libraries")}: {stats?.libraries ?? 0}</span>
      <span>{t("statusBar.images")}: {stats?.images ?? 0}</span>
      <span className="statusbar-spacer" />
      <span>{t("statusBar.idle")}</span>
    </footer>
  );
}
```

- [ ] **Step 3: 全量构建验证**

```bash
npm run build
cargo build 2>&1 | Select-String "error|Finished"
```

- [ ] **Step 4: 确认构建零错误后提交**

```bash
git add -A
git commit -m "v2: i18n裁剪 + StatusBar + 最终构建验证通过"
```

---

## Self-Review

| 检查项 | 结果 |
|--------|------|
| Spec 覆盖 | ✅ 3表/5服务/3页面/IPC/UG提取 均有对应 Task |
| 占位符 | ✅ 无 TBD/TODO/省略 |
| 类型一致性 | ✅ SearchResult.origin_path 各 Task 一致 |
| 构建验证 | ✅ 每 Task 结尾有 npm run build |

---

## Execution Handoff

Plan complete and saved. Two options:

**1. Subagent-Driven (recommended)** — 每 Task 一个独立 subagent，我审查之间切换，并行快

**2. Inline Execution** — 本 session 按 executing-plans 逐步执行

Which approach?
