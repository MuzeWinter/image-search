# Phase 6: Polish + Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete all polish work: dark theme full-page adaptation, complete i18n translation, first-launch guide, error handling improvements, backup/restore, and Tauri .msi packaging.

**Architecture:** Incremental fixes to existing files + 3 new components (WelcomeGuide, Toast, ErrorBoundary) + backend backup/restore methods + Tauri bundler config. No architectural changes.

**Tech Stack:** React 18 + TypeScript, Tauri v2 (Rust), Python 3 JSON-RPC backend, SQLite, OKLCH CSS variables

---

## Task 1: Fix i18n Hardcoded Strings

**Files:**
- Modify: `src/components/shared/LocaleToggle.tsx` (fix hardcoded title/aria-label)
- Modify: `src/components/shared/InlineError.tsx` (fix hardcoded default retryLabel)
- Modify: `src/pages/Settings.tsx` (fix hardcoded "AI", "ON", "OFF")
- Modify: `src/pages/Search.tsx` (fix hardcoded "OCR:", "EX:", "CAD:", "PDF:" association labels)
- Modify: `src/pages/ImageLibrary.tsx` (fix hardcoded "IMG", "EX" source badges)
- Modify: `src/i18n/zh.json` (add missing keys)
- Modify: `src/i18n/en.json` (add missing keys)

### Step 1: Add new translation keys to zh.json

In `src/i18n/zh.json`, add after the `favorites` section (before the closing `}`):

```json
  "settings": {
    ...existing keys...
    "aiFeatures": "AI 功能",
    "toggleOn": "开",
    "toggleOff": "关",
    "backup": "备份与维护",
    "backupDb": "备份数据库",
    "backupDbSuccess": "数据库已备份",
    "restoreDb": "恢复数据库",
    "restoreDbConfirm": "恢复数据库将替换当前数据，确定继续？",
    "restoreDbSuccess": "数据库已恢复",
    "rebuildIndex": "重建索引",
    "rebuildIndexConfirm": "重建索引将清除并重新构建所有向量索引，确定继续？",
    "rebuildIndexSuccess": "索引已重建",
    "clearCache": "清理缓存",
    "clearCacheSuccess": "缓存已清理"
```

Add to `common` section after `confirm`:
```json
    "done": "完成",
    "close": "关闭",
    "next": "下一步",
    "back": "上一步",
    "skip": "跳过",
    "start": "开始",
    "success": "操作成功",
    "failed": "操作失败",
    "unknownError": "未知错误",
    "noPermission": "权限不足",
    "fileNotFound": "文件不存在",
    "dbCorrupted": "数据库可能已损坏，建议备份后重建",
    "pythonNotFound": "未检测到 Python 环境，请安装 Python 3.9+",
    "operationTimeout": "操作超时，请重试"
```

Add new top-level sections for first-launch guide:
```json
  "welcome": {
    "step1Title": "欢迎使用 ZOOBET 智能检索",
    "step1Desc": "本地 AI 视觉搜索引擎，专为产品设计师打造。\n支持图片相似检索、CAD/Excel/PDF 文件管理、智能匹配等功能。",
    "step2Title": "选择资料库文件夹",
    "step2Desc": "资料库是存放产品图片、CAD 图纸、Excel 表格和 PDF 文档的文件夹。\n添加资料库后，系统将自动扫描并索引其中的文件。",
    "step2Browse": "浏览文件夹",
    "step2NoPath": "请先选择资料库文件夹",
    "step3Title": "首次扫描",
    "step3Desc": "扫描将索引资料库中的所有文件，提取图片特征向量用于 AI 搜索。\n扫描时间取决于文件数量，完成后即可开始搜索。",
    "step3ScanNow": "开始扫描",
    "step3Skip": "稍后再说",
    "step4Title": "准备就绪！",
    "step4Desc": "一切就绪！您可以：\n• 在搜索页拖入图片进行 AI 相似搜索\n• 在图片库浏览和管理所有图片\n• 在匹配管理查看文件关联\n• 随时在设置中修改配置",
    "step4Start": "开始使用"
```

Add for toast/notifications:
```json
  "toast": {
    "success": "成功",
    "error": "错误",
    "warning": "警告",
    "info": "提示"
```

Add for error boundary:
```json
  "errorBoundary": {
    "title": "页面出错了",
    "message": "应用遇到了意外错误，请尝试刷新页面。",
    "reload": "刷新页面"
```

Update `search` to add association type labels (in `aiSearch` section):
```json
    "assocOcr": "OCR",
    "assocExcel": "EX",
    "assocCad": "CAD",
    "assocPdf": "PDF"
```

Update `imageLibrary` to add source badge labels:
```json
    "badgeImg": "IMG",
    "badgeEx": "EX"
```

### Step 2: Add same keys to en.json

Same structure, English values:

```json
  "settings": {
    ...existing keys...
    "aiFeatures": "AI Features",
    "toggleOn": "ON",
    "toggleOff": "OFF",
    "backup": "Backup & Maintenance",
    "backupDb": "Backup Database",
    "backupDbSuccess": "Database backed up",
    "restoreDb": "Restore Database",
    "restoreDbConfirm": "Restoring database will replace current data. Continue?",
    "restoreDbSuccess": "Database restored",
    "rebuildIndex": "Rebuild Index",
    "rebuildIndexConfirm": "Rebuilding index will clear and rebuild all vector indexes. Continue?",
    "rebuildIndexSuccess": "Index rebuilt",
    "clearCache": "Clear Cache",
    "clearCacheSuccess": "Cache cleared"
```

```json
  "common": {
    ...
    "done": "Done",
    "close": "Close",
    "next": "Next",
    "back": "Back",
    "skip": "Skip",
    "start": "Start",
    "success": "Success",
    "failed": "Failed",
    "unknownError": "Unknown error",
    "noPermission": "Permission denied",
    "fileNotFound": "File not found",
    "dbCorrupted": "Database may be corrupted. Consider backup and rebuild.",
    "pythonNotFound": "Python environment not detected. Please install Python 3.9+",
    "operationTimeout": "Operation timed out, please retry"
```

```json
  "welcome": {
    "step1Title": "Welcome to ZOOBET Intelligent Search",
    "step1Desc": "Local AI visual search engine, built for product designers.\nSupports image similarity search, CAD/Excel/PDF file management, smart matching, and more.",
    "step2Title": "Select Library Folder",
    "step2Desc": "A library is a folder containing product images, CAD drawings, Excel sheets, and PDF documents.\nAfter adding a library, the system will automatically scan and index its files.",
    "step2Browse": "Browse Folder",
    "step2NoPath": "Please select a library folder first",
    "step3Title": "First Scan",
    "step3Desc": "Scanning will index all files in the library and extract image feature vectors for AI search.\nScan time depends on file count. You can start searching once complete.",
    "step3ScanNow": "Start Scan",
    "step3Skip": "Maybe Later",
    "step4Title": "Ready!",
    "step4Desc": "Everything is set up! You can:\n• Drag images into Search for AI similarity search\n• Browse and manage all images in Image Library\n• View file associations in Match Management\n• Modify settings anytime",
    "step4Start": "Get Started"
```

```json
  "toast": {
    "success": "Success",
    "error": "Error",
    "warning": "Warning",
    "info": "Info"
```

```json
  "errorBoundary": {
    "title": "Page Error",
    "message": "The app encountered an unexpected error. Try refreshing the page.",
    "reload": "Reload Page"
```

```json
    "assocOcr": "OCR",
    "assocExcel": "EX",
    "assocCad": "CAD",
    "assocPdf": "PDF"
```

```json
    "badgeImg": "IMG",
    "badgeEx": "EX"
```

### Step 3: Fix LocaleToggle.tsx

Replace the title/aria-label with i18n keys:

```tsx
import { useI18n } from "../../i18n/context";

export function LocaleToggle() {
  const { locale, setLocale } = useI18n();

  function toggle() {
    setLocale(locale === "zh" ? "en" : "zh");
  }

  return (
    <button
      className="toggle-btn locale-toggle"
      onClick={toggle}
      title={locale === "zh" ? "Switch to English" : "切换到中文"}
      aria-label={locale === "zh" ? "Switch to English" : "切换到中文"}
    >
      {locale === "zh" ? "EN" : "中"}
    </button>
  );
}
```

Wait — the `title` and `aria-label` cannot use `t()` here because they switch based on current locale. Instead, we need a dedicated locale-toggle key. Add to both zh.json and en.json:

zh.json `common`:
```json
    "switchToZh": "切换到中文",
    "switchToEn": "Switch to English"
```

en.json `common`:
```json
    "switchToEn": "Switch to English",
    "switchToZh": "切换到中文"
```

Then in LocaleToggle:
```tsx
import { useI18n } from "../../i18n/context";

export function LocaleToggle() {
  const { locale, setLocale, t } = useI18n();

  function toggle() {
    setLocale(locale === "zh" ? "en" : "zh");
  }

  const nextLabel = locale === "zh" ? t("common.switchToEn") : t("common.switchToZh");

  return (
    <button
      className="toggle-btn locale-toggle"
      onClick={toggle}
      title={nextLabel}
      aria-label={nextLabel}
    >
      {locale === "zh" ? "EN" : "中"}
    </button>
  );
}
```

### Step 4: Fix InlineError.tsx

Replace hardcoded default `retryLabel` with i18n:

```tsx
import { useI18n } from "../../i18n/context";

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function InlineError({ message, onRetry, retryLabel }: InlineErrorProps) {
  const { t } = useI18n();
  const label = retryLabel ?? t("common.retry");

  return (
    <div className="inline-error" role="alert">
      <svg
        className="inline-error-icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span className="inline-error-message">{message}</span>
      {onRetry && (
        <button className="inline-error-retry" onClick={onRetry}>
          {label}
        </button>
      )}
    </div>
  );
}
```

### Step 5: Fix Settings.tsx hardcoded strings

Replace "AI" section title and "ON"/"OFF" toggle buttons with i18n keys.

Lines 133-141: Change the section header and toggle buttons:

Current:
```tsx
        <h3>AI</h3>
```
New:
```tsx
        <h3>{t("settings.aiFeatures")}</h3>
```

Current:
```tsx
              ON
            </button>
            <button
              className={`settings-option-btn ${!ocrEnabled ? "active" : ""}`}
              onClick={handleOcrToggle}
            >
              OFF
```
New:
```tsx
              {t("settings.toggleOn")}
            </button>
            <button
              className={`settings-option-btn ${!ocrEnabled ? "active" : ""}`}
              onClick={handleOcrToggle}
            >
              {t("settings.toggleOff")}
```

### Step 6: Fix Search.tsx hardcoded association labels

Find the lines with hardcoded "OCR:", "EX:", "CAD:", "PDF:" (around line 277, 332, 347, 361) and replace with `t("aiSearch.assocOcr")`, `t("aiSearch.assocExcel")`, `t("aiSearch.assocCad")`, `t("aiSearch.assocPdf")`.

The Search.tsx needs to be read first to find exact lines, then each hardcoded prefix label replaced.

### Step 7: Fix ImageLibrary.tsx hardcoded source badge

Line ~329: Replace hardcoded "IMG" / "EX" with `t("imageLibrary.badgeImg")` / `t("imageLibrary.badgeEx")`.

---

## Task 2: Dark Theme — Verify and Fix Gaps

**Files:**
- Modify: `src/styles/shell.css` (settings-option-btn inactive state + input backgrounds)
- Modify: `src/styles/search.css` (context menu / popup dark adaptation)

### Step 1: Fix settings-option-btn inactive state

In `src/styles/shell.css`, ensure settings option buttons have proper dark background when inactive. Add these rules:

```css
.settings-option-btn {
  background: var(--surface);
  color: var(--fg);
  border: var(--border-width) solid var(--border);
}

.settings-option-btn:hover {
  background: var(--surface-hover);
}

.settings-option-btn.active {
  background: var(--accent);
  color: white;
  border-color: var(--accent);
}
```

(Check if these rules already exist. If not, add them. If they exist but are missing dark variants, fix them.)

### Step 2: Verify input backgrounds

Search for any `background: white` or `background: #fff` or `background: #ffffff` in all CSS files: `grep` for hardcoded white/black colors. Replace any found with CSS variable equivalents.

```bash
grep -rn 'background.*#[fF0]' src/styles/ || echo "No hardcoded white backgrounds found"
grep -rn 'color.*#[fF0]' src/styles/ || echo "No hardcoded white text found"
```

### Step 3: Tags dialog dark adaptation

In `src/styles/search.css`, verify `.tags-dialog-overlay` and `.tags-dialog` use CSS variables. The search reported they use `var(--surface)`, `var(--border)`, `var(--fg)`, `var(--shadow-modal)` — this is already correct.

### Step 4: Input/select element dark styles

Add explicit dark styles for native input and select elements:

```css
input, select, textarea {
  background: var(--surface);
  color: var(--fg);
  border: var(--border-width) solid var(--border);
}

input::placeholder, textarea::placeholder {
  color: var(--muted);
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--accent);
}
```

Add to `src/styles/design-system.css` after the existing input rule.

---

## Task 3: First-Launch Welcome Guide

**Files:**
- Create: `src/components/shared/WelcomeGuide.tsx` (wizard component)
- Create: `src/components/shared/WelcomeGuide.css` (wizard styles, or add to shell.css)
- Modify: `src/pages/Home.tsx` (integrate welcome guide)
- Modify: `src/i18n/zh.json` (keys already added in Task 1)
- Modify: `src/i18n/en.json` (keys already added in Task 1)

### Step 1: Create WelcomeGuide component

```tsx
// src/components/shared/WelcomeGuide.tsx
import { useState, useCallback } from "react";
import { useI18n } from "../../i18n/context";
import { useServiceQuery } from "../../stores/hooks";
import * as libraryService from "../../services/libraryService";
import type { Library } from "../../services/types";

interface Props {
  onComplete: () => void;
}

const STEPS = ["welcome", "library", "scan", "ready"] as const;
type Step = (typeof STEPS)[number];

export function WelcomeGuide({ onComplete }: Props) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>("welcome");
  const [libPath, setLibPath] = useState("");
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [libId, setLibId] = useState<number | null>(null);

  const { refetch: refetchLibs } = useServiceQuery<Library[]>("libraryService", "library.list");

  const handleBrowse = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ directory: true, multiple: false, title: t("library.selectFolder") });
      if (selected && typeof selected === "string") {
        setLibPath(selected);
        setError("");
      }
    } catch {
      setError(t("common.unknownError"));
    }
  }, [t]);

  const handleAddLibrary = useCallback(async () => {
    const path = libPath.trim();
    if (!path) { setError(t("welcome.step2NoPath")); return; }
    setAdding(true);
    setError("");
    try {
      const result = await libraryService.add(path) as { id: number };
      setLibId(result.id);
      refetchLibs();
      setStep("scan");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setAdding(false);
    }
  }, [libPath, refetchLibs, t]);

  const handleScan = useCallback(async () => {
    if (!libId) return;
    setScanning(true);
    setError("");
    try {
      await libraryService.scan(libId);
      setStep("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  }, [libId]);

  const stepIndex = STEPS.indexOf(step);
  const totalSteps = STEPS.length;

  return (
    <div className="welcome-overlay">
      <div className="welcome-dialog">
        <div className="welcome-progress">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`welcome-dot ${i === stepIndex ? "active" : i < stepIndex ? "done" : ""}`}
            />
          ))}
        </div>

        {step === "welcome" && (
          <div className="welcome-step">
            <h2 className="welcome-step-title">{t("welcome.step1Title")}</h2>
            <p className="welcome-step-desc">{t("welcome.step1Desc")}</p>
            <button className="welcome-btn-primary" onClick={() => setStep("library")}>
              {t("common.next")}
            </button>
          </div>
        )}

        {step === "library" && (
          <div className="welcome-step">
            <h2 className="welcome-step-title">{t("welcome.step2Title")}</h2>
            <p className="welcome-step-desc">{t("welcome.step2Desc")}</p>
            <div className="welcome-input-row">
              <input
                type="text"
                className="welcome-input"
                placeholder={t("settings.libraryPathHint")}
                value={libPath}
                onChange={(e) => setLibPath(e.target.value)}
                readOnly
              />
              <button className="welcome-btn-secondary" onClick={handleBrowse}>
                {t("welcome.step2Browse")}
              </button>
            </div>
            {error && <p className="welcome-error">{error}</p>}
            <div className="welcome-step-actions">
              <button className="welcome-btn-text" onClick={() => setStep("welcome")}>
                {t("common.back")}
              </button>
              <button
                className="welcome-btn-primary"
                onClick={handleAddLibrary}
                disabled={adding}
              >
                {adding ? t("common.loading") : t("common.next")}
              </button>
            </div>
          </div>
        )}

        {step === "scan" && (
          <div className="welcome-step">
            <h2 className="welcome-step-title">{t("welcome.step3Title")}</h2>
            <p className="welcome-step-desc">{t("welcome.step3Desc")}</p>
            {error && <p className="welcome-error">{error}</p>}
            <div className="welcome-step-actions">
              <button className="welcome-btn-text" onClick={() => setStep("library")}>
                {t("common.back")}
              </button>
              <button className="welcome-btn-text" onClick={() => setStep("ready")}>
                {t("welcome.step3Skip")}
              </button>
              <button
                className="welcome-btn-primary"
                onClick={handleScan}
                disabled={scanning}
              >
                {scanning ? t("library.scanning") : t("welcome.step3ScanNow")}
              </button>
            </div>
          </div>
        )}

        {step === "ready" && (
          <div className="welcome-step">
            <h2 className="welcome-step-title">{t("welcome.step4Title")}</h2>
            <p className="welcome-step-desc">{t("welcome.step4Desc")}</p>
            <button className="welcome-btn-primary" onClick={onComplete}>
              {t("welcome.step4Start")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

### Step 2: Add WelcomeGuide CSS

Add to `src/styles/shell.css`:

```css
/* === Welcome Guide === */
.welcome-overlay {
  position: fixed;
  inset: 0;
  background: oklch(0% 0 0 / 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.welcome-dialog {
  background: var(--surface);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--space-10) var(--space-12);
  max-width: 520px;
  width: 90%;
  box-shadow: var(--shadow-modal);
}

.welcome-progress {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  margin-bottom: var(--space-8);
}

.welcome-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--border);
  transition: background 0.2s;
}

.welcome-dot.active {
  background: var(--accent);
  width: 28px;
  border-radius: 5px;
}

.welcome-dot.done {
  background: var(--success);
}

.welcome-step-title {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  color: var(--fg);
  margin-bottom: var(--space-4);
  text-align: center;
}

.welcome-step-desc {
  font-size: var(--text-sm);
  color: var(--muted);
  margin-bottom: var(--space-8);
  text-align: center;
  line-height: 1.6;
  white-space: pre-line;
}

.welcome-input-row {
  display: flex;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.welcome-input {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  background: var(--bg);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-md);
  color: var(--fg);
  font-size: var(--text-sm);
}

.welcome-input:focus {
  border-color: var(--accent);
  outline: none;
}

.welcome-error {
  color: var(--danger);
  font-size: var(--text-sm);
  margin-bottom: var(--space-4);
}

.welcome-step-actions {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.welcome-btn-primary {
  padding: var(--space-3) var(--space-8);
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}

.welcome-btn-primary:hover {
  opacity: 0.9;
}

.welcome-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.welcome-btn-secondary {
  padding: var(--space-3) var(--space-5);
  background: var(--surface);
  color: var(--fg);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background 0.15s;
}

.welcome-btn-secondary:hover {
  background: var(--surface-hover);
}

.welcome-btn-text {
  padding: var(--space-3) var(--space-4);
  background: none;
  color: var(--muted);
  border: none;
  font-size: var(--text-sm);
  cursor: pointer;
}

.welcome-btn-text:hover {
  color: var(--fg);
}
```

### Step 3: Integrate into Home.tsx

Add after the existing imports:
```tsx
import { useState, useEffect } from "react"; // update existing import
import { WelcomeGuide } from "../components/shared/WelcomeGuide";
```

Add state and check at top of component:
```tsx
const [showGuide, setShowGuide] = useState(false);

useEffect(() => {
  const seen = localStorage.getItem("zoobet_welcome_done");
  if (!seen) {
    // Defer showing until stats load to avoid flash
    const t = setTimeout(() => setShowGuide(true), 300);
    return () => clearTimeout(t);
  }
}, []);

const handleGuideComplete = () => {
  localStorage.setItem("zoobet_welcome_done", "1");
  setShowGuide(false);
};
```

Add at end of JSX (before closing `</div>`):
```tsx
{showGuide && <WelcomeGuide onComplete={handleGuideComplete} />}
```

---

## Task 4: Toast Notification System + Error Handling

**Files:**
- Create: `src/components/shared/Toast.tsx` (toast component)
- Create: `src/components/shared/Toast.css` (or add to shell.css)
- Create: `src/components/shared/ErrorBoundary.tsx`
- Modify: `src/App.tsx` (wrap with ErrorBoundary)
- Modify: `src-tauri/src/lib.rs` (add health-check command, better error messages)
- Modify: `src/services/registry.ts` (add timeout)

### Step 1: Create Toast component and provider

```tsx
// src/components/shared/Toast.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useI18n } from "../../i18n/context";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (type: ToastType, message: string) => void;
}

const ToastContext = createContext<ToastContextValue>(null!);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((type: ToastType, message: string) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-item toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Close">
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
```

### Step 2: Add Toast CSS

Add to `src/styles/shell.css`:

```css
/* === Toast Notifications === */
.toast-container {
  position: fixed;
  bottom: calc(var(--statusbar-h) + var(--space-4));
  right: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  z-index: 2000;
  max-width: 380px;
}

.toast-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-overlay);
  font-size: var(--text-sm);
  animation: toast-in 0.2s ease;
}

.toast-success {
  background: var(--success);
  color: white;
}

.toast-error {
  background: var(--danger);
  color: white;
}

.toast-warning {
  background: var(--warning);
  color: #1a1a1a;
}

.toast-info {
  background: var(--info);
  color: white;
}

.toast-message {
  flex: 1;
}

.toast-close {
  background: none;
  border: none;
  color: inherit;
  font-size: var(--text-lg);
  cursor: pointer;
  opacity: 0.7;
  padding: 0 var(--space-1);
}

.toast-close:hover {
  opacity: 1;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Step 3: Create ErrorBoundary

```tsx
// src/components/shared/ErrorBoundary.tsx
import { Component, type ReactNode } from "react";
import { useI18n } from "../../i18n/context";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundaryInner extends Component<Props & { t: (k: string) => string }, State> {
  constructor(props: Props & { t: (k: string) => string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <h2>{this.props.t("errorBoundary.title")}</h2>
            <p>{this.props.t("errorBoundary.message")}</p>
            {this.state.error && (
              <pre className="error-boundary-detail">{this.state.error.message}</pre>
            )}
            <button
              className="error-boundary-reload"
              onClick={() => window.location.reload()}
            >
              {this.props.t("errorBoundary.reload")}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export function ErrorBoundary({ children }: Props) {
  return (
    <ErrorBoundaryInner t={useI18n().t}>
      {children}
    </ErrorBoundaryInner>
  );
}
```

Add CSS for error boundary to `shell.css`:
```css
/* === Error Boundary === */
.error-boundary {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--bg);
  padding: var(--space-8);
}

.error-boundary-content {
  text-align: center;
  max-width: 480px;
}

.error-boundary-content h2 {
  font-family: var(--font-display);
  font-size: var(--text-xl);
  color: var(--danger);
  margin-bottom: var(--space-4);
}

.error-boundary-content p {
  color: var(--muted);
  margin-bottom: var(--space-6);
}

.error-boundary-detail {
  text-align: left;
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  background: var(--surface);
  border: var(--border-width) solid var(--border);
  padding: var(--space-4);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-6);
  overflow-x: auto;
  color: var(--muted);
}

.error-boundary-reload {
  padding: var(--space-3) var(--space-8);
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  cursor: pointer;
}
```

### Step 4: Integrate Toast and ErrorBoundary in App.tsx

Wrap app with ToastProvider and ErrorBoundary:

```tsx
// Add imports
import { ToastProvider } from "./components/shared/Toast";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";

// Wrap the app:
export function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ErrorBoundary>
          <ToastProvider>
            <BrowserRouter>
              ...
            </BrowserRouter>
          </ToastProvider>
        </ErrorBoundary>
      </I18nProvider>
    </ThemeProvider>
  );
}
```

### Step 5: Add Python health check to Rust lib.rs

Add a new command `check_backend` to lib.rs:

```rust
#[tauri::command]
fn check_backend(app_handle: tauri::AppHandle) -> Result<serde_json::Value, String> {
    // Check if Python is available
    let python = find_python();
    let check = Command::new(python)
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn();

    match check {
        Ok(mut child) => {
            let _ = child.wait();
            // Python exists, check backend path
            match resolve_backend_path(&app_handle) {
                Ok(path) => Ok(serde_json::json!({
                    "python_available": true,
                    "python_binary": python,
                    "backend_path": path.to_string_lossy()
                })),
                Err(e) => Ok(serde_json::json!({
                    "python_available": true,
                    "python_binary": python,
                    "backend_path_error": e
                }))
            }
        }
        Err(_) => Ok(serde_json::json!({
            "python_available": false,
            "python_binary": python,
            "error": "Python not found. Please install Python 3.9 or later."
        }))
    }
}
```

Register in the invoke_handler:
```rust
.invoke_handler(tauri::generate_handler![
    call_backend,
    scan_library,
    cancel_scan,
    check_backend
])
```

### Step 6: Add IPC timeout to service registry

In `src/services/registry.ts`, add a `callWithTimeout` helper:

In the `ServiceRegistry` class, add:
```ts
async invokeWithTimeout<T>(name: string, method: string, params?: unknown, timeoutMs = 30000): Promise<T> {
  await this.ensureReady(name);
  const svc = this.services.get(name)!;
  const result = svc.invoke<T>(method, params);
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Operation timed out")), timeoutMs)
  );
  return Promise.race([result, timeout]);
}
```

---

## Task 5: Backup/Restore Backend + Settings UI

**Files:**
- Modify: `backend/services/db_service.py` (add backup, restore, rebuild_index, clear_cache methods)
- Modify: `src/pages/Settings.tsx` (add backup/restore/rebuild/clear buttons)
- Modify: `src/i18n/zh.json` (keys already added in Task 1)
- Modify: `src/i18n/en.json` (keys already added in Task 1)
- Modify: `src/services/dbService.ts` (add frontend call wrappers)
- Modify: `src/services/settingsService.ts` (no change needed, uses dbService)

### Step 1: Add backend methods to db_service.py

Add new execute routes and implementations:

```python
import shutil
import os
import tempfile
from datetime import datetime

def execute(method: str, params: dict):
    # ... existing routes ...
    elif method == "db.backup":
        return _backup(params.get("target_path", ""))
    elif method == "db.restore":
        return _restore(params.get("source_path", ""))
    elif method == "db.rebuildIndex":
        return _rebuild_index()
    elif method == "db.clearCache":
        return _clear_cache()
    else:
        raise ValueError(f"Unknown db method: {method}")


def _backup(target_path: str = ""):
    """Backup database to target path or default location"""
    from backend.db.connection import get_db_path
    src = get_db_path()
    if not os.path.exists(src):
        raise ValueError("Database file not found")

    if not target_path:
        backup_dir = os.path.join(os.path.dirname(src), "backups")
        os.makedirs(backup_dir, exist_ok=True)
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        target_path = os.path.join(backup_dir, f"zoobet_backup_{ts}.db")

    shutil.copy2(src, target_path)
    return {"ok": True, "path": target_path}


def _restore(source_path: str):
    """Restore database from backup file"""
    if not source_path:
        raise ValueError("source_path is required")
    if not os.path.exists(source_path):
        raise ValueError(f"Backup file not found: {source_path}")

    from backend.db.connection import get_db_path, close_connection
    # Close existing connections
    close_connection()

    dst = get_db_path()
    # Create a safety backup of current DB before restoring
    safety = dst + ".pre_restore"
    if os.path.exists(dst):
        shutil.copy2(dst, safety)

    shutil.copy2(source_path, dst)
    return {"ok": True, "safety_backup": safety}


def _rebuild_index():
    """Clear vector embeddings and trigger index rebuild"""
    global _index, _index_img_ids, _index_status

    from backend.db.connection import get_connection
    conn = get_connection()
    conn.execute("DELETE FROM vector_embeddings")
    conn.commit()

    # Reset in-memory index
    with _index_lock:
        _index = None
        _index_img_ids = None
        _index_status = {"built": False, "count": 0, "dim": 0}

    return {"ok": True, "message": "Embeddings cleared. Re-scan or re-index to rebuild."}


def _clear_cache():
    """Clear temporary/cache files"""
    import glob

    cleaned = 0
    tmpdir = os.environ.get("TEMP") or os.environ.get("TMP") or tempfile.gettempdir()

    # Clean model progress files
    for pattern in ["zoobet_model_progress.json", "zoobet_index_progress.json"]:
        for f in glob.glob(os.path.join(tmpdir, pattern)):
            try:
                os.remove(f)
                cleaned += 1
            except OSError:
                pass

    # Clean Python cache dirs
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    for root, dirs, _files in os.walk(backend_dir):
        if "__pycache__" in dirs:
            pycache = os.path.join(root, "__pycache__")
            try:
                shutil.rmtree(pycache)
                cleaned += 1
            except OSError:
                pass

    return {"ok": True, "cleaned": cleaned}
```

Note: The `_rebuild_index` function needs access to the global index lock. Import from search_service or refactor. Since these globals are in `search_service.py`, add a helper there:

In `backend/services/search_service.py`, add:
```python
def reset_index():
    """Reset the in-memory FAISS index (for rebuild)"""
    global _index, _index_img_ids, _index_status
    with _index_lock:
        _index = None
        _index_img_ids = None
        _index_status = {"built": False, "count": 0, "dim": 0}
```

And in `db_service.py` _rebuild_index, call:
```python
from backend.services.search_service import reset_index
# Clear embeddings from DB
conn = get_connection()
conn.execute("DELETE FROM vector_embeddings")
conn.commit()
# Reset in-memory index
reset_index()
```

### Step 2: Add frontend service methods

In `src/services/dbService.ts`, add:

```ts
export async function backup(targetPath?: string): Promise<{ path: string }> {
  await serviceRegistry.ensureReady("dbService");
  return call("db.backup", { target_path: targetPath ?? "" }) as Promise<{ path: string }>;
}

export async function restore(sourcePath: string): Promise<{ safety_backup: string }> {
  await serviceRegistry.ensureReady("dbService");
  return call("db.restore", { source_path: sourcePath }) as Promise<{ safety_backup: string }>;
}

export async function rebuildIndex(): Promise<{ message: string }> {
  await serviceRegistry.ensureReady("dbService");
  return call("db.rebuildIndex") as Promise<{ message: string }>;
}

export async function clearCache(): Promise<{ cleaned: number }> {
  await serviceRegistry.ensureReady("dbService");
  return call("db.clearCache") as Promise<{ cleaned: number }>;
}
```

### Step 3: Add backup/restore UI to Settings.tsx

Add after the "Data" section (before "About"):

```tsx
{/* Backup & Maintenance */}
<section className="settings-section">
  <h3>{t("settings.backup")}</h3>

  <div className="settings-row">
    <label className="settings-label">{t("settings.backupDb")}</label>
    <button className="settings-btn-secondary" onClick={handleBackup}>
      {t("settings.backupDb")}
    </button>
  </div>

  <div className="settings-row">
    <label className="settings-label">{t("settings.restoreDb")}</label>
    <button className="settings-btn-secondary" onClick={handleRestore}>
      {t("settings.restoreDb")}
    </button>
  </div>

  <div className="settings-row">
    <label className="settings-label">{t("settings.rebuildIndex")}</label>
    <button className="settings-btn-danger" onClick={handleRebuildIndex}>
      {t("settings.rebuildIndex")}
    </button>
  </div>

  <div className="settings-row">
    <label className="settings-label">{t("settings.clearCache")}</label>
    <button className="settings-btn-secondary" onClick={handleClearCache}>
      {t("settings.clearCache")}
    </button>
  </div>

  {saveMsg && <p className="settings-msg">{saveMsg}</p>}
</section>
```

Add handler functions in the component:

```tsx
const handleBackup = async () => {
  try {
    const result = await (await import("../services/dbService")).backup();
    setSaveMsg(`${t("settings.backupDbSuccess")}: ${result.path}`);
    setTimeout(() => setSaveMsg(""), 4000);
  } catch (e) {
    setSaveMsg(e instanceof Error ? e.message : String(e));
  }
};

const handleRestore = async () => {
  if (!window.confirm(t("settings.restoreDbConfirm"))) return;
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: false,
      filters: [{ name: "Database", extensions: ["db"] }],
      title: t("settings.restoreDb"),
    });
    if (selected && typeof selected === "string") {
      await (await import("../services/dbService")).restore(selected);
      setSaveMsg(t("settings.restoreDbSuccess"));
      setTimeout(() => setSaveMsg(""), 4000);
    }
  } catch (e) {
    setSaveMsg(e instanceof Error ? e.message : String(e));
  }
};

const handleRebuildIndex = async () => {
  if (!window.confirm(t("settings.rebuildIndexConfirm"))) return;
  try {
    await (await import("../services/dbService")).rebuildIndex();
    setSaveMsg(t("settings.rebuildIndexSuccess"));
    setTimeout(() => setSaveMsg(""), 4000);
  } catch (e) {
    setSaveMsg(e instanceof Error ? e.message : String(e));
  }
};

const handleClearCache = async () => {
  try {
    const result = await (await import("../services/dbService")).clearCache();
    setSaveMsg(`${t("settings.clearCacheSuccess")} (${result.cleaned} files)`);
    setTimeout(() => setSaveMsg(""), 4000);
  } catch (e) {
    setSaveMsg(e instanceof Error ? e.message : String(e));
  }
};
```

Add CSS for secondary button if not exists (in shell.css):
```css
.settings-btn-secondary {
  padding: var(--space-2) var(--space-5);
  background: var(--surface);
  color: var(--fg);
  border: var(--border-width) solid var(--border);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  cursor: pointer;
  transition: background 0.15s;
}

.settings-btn-secondary:hover {
  background: var(--surface-hover);
}
```

---

## Task 6: Tauri Packaging for .msi

**Files:**
- Modify: `src-tauri/tauri.conf.json` (add bundle config)
- Modify: `src-tauri/Cargo.toml` (if needed for bundler features)
- Modify: `src-tauri/src/lib.rs` (handle Python sidecar in release builds)

### Step 1: Configure Tauri bundler for .msi

Update `src-tauri/tauri.conf.json` — add bundle section:

```json
{
  ...existing config...
  "bundle": {
    "active": true,
    "targets": "msi",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.ico",
      "icons/icon.png"
    ],
    "resources": {
      "backend/": "./backend/"
    },
    "windows": {
      "wix": {
        "language": "zh-CN"
      },
      "nsis": null
    }
  }
}
```

Note: The critical piece is `"resources"` — this bundles the `backend/` directory into the Tauri resource directory so it can be found by `resolve_backend_path()` in lib.rs at runtime.

### Step 2: Verify resource bundling path

The lib.rs `resolve_backend_path` already checks `resource_dir().join("backend").join("main.py")` — this matches the `resources` config above.

### Step 3: Add Python sidecar detection with user-friendly error

In lib.rs `call_backend`, improve the error message when Python is not found:

```rust
fn find_python() -> Result<&'static str, String> {
    // Try common Python paths
    let candidates: &[&str] = if cfg!(target_os = "windows") {
        &["python", "python3", "py"]
    } else {
        &["python3", "python"]
    };

    for cmd in candidates {
        if Command::new(cmd)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .is_ok()
        {
            return Ok(cmd);
        }
    }

    Err("Python not found. Please install Python 3.9+ from https://python.org".to_string())
}
```

Then update `call_backend` to use the new signature:

```rust
let python = find_python()
    .map_err(|e| format!("{}. Install Python 3.9+ to use this application.", e))?;
```

### Step 4: AI model handling

The AI model (OpenCLIP ViT-B/32) is too large (~600MB+) to bundle. The current approach of downloading on first use is correct. Add a check in `backend/services/ai_service.py` that reports model download progress clearly.

Verify that `_load_model()` in `ai_service.py` uses `open_clip.create_model_and_transforms` which downloads from HuggingFace automatically. The model status is already reported via a temp progress file — this is adequate for the packaging task.

### Step 5: Build and verify

The actual build command:
```bash
cd "G:/Ai project/Image Search"
npm run tauri build
```

Expected output: `src-tauri/target/release/bundle/msi/ZOOBET检索_0.1.0_x64_zh-CN.msi`

### Step 6: Verify Cargo.toml has bundler features

Check that `src-tauri/Cargo.toml` has the required Tauri features for bundling. If features section is missing add:
```toml
[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

---

## Task 7: Final Verification

### Step 1: TypeScript build check
```bash
cd "G:/Ai project/Image Search" && npx tsc --noEmit
```
Fix any type errors.

### Step 2: Vite build check
```bash
cd "G:/Ai project/Image Search" && npm run build
```
Fix any build errors.

### Step 3: Verify all i18n keys
Check that every `t("...")` call in the codebase has a corresponding key in both zh.json and en.json. Write a quick script or do a manual audit.

### Step 4: Verify dark theme
Set theme to dark and visually check:
- Settings page (AI section, backup section)
- WelcomeGuide dialog
- Toast notifications
- Input elements, buttons

### Step 5: Verify first-launch flow
- Clear localStorage `zoobet_welcome_done`
- Reload app
- Complete all 4 wizard steps
- Verify `zoobet_welcome_done` is set after completion

---

## Implementation Order

1. **Task 1** (i18n fixes) — foundation for all other tasks
2. **Task 2** (dark theme verification) — can run in parallel with Task 1
3. **Task 3** (first-launch guide) — depends on Task 1 for i18n keys
4. **Task 4** (error handling/toast) — independent, can run in parallel
5. **Task 5** (backup/restore) — depends on Task 1 for i18n keys
6. **Task 6** (packaging) — last, after all code changes verified
7. **Task 7** (final verification) — after all tasks complete
