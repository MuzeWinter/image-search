# Quality Audit Report — v2-105

**Date:** 2026-06-21  
**Scope:** Full project quality review  
**Baseline:** `npm run check` — 8/8 PASS

---

## 1. TODO / FIXME / HACK Comments

**Result: PASS — Zero issues**

Searched all source files (`.ts`, `.tsx`, `.rs`, `.py`, `.css`, `.html`, `.js`) excluding `node_modules`, `dist`, `.git`, `test-data`.

| Metric | Value |
|--------|-------|
| TODO comments | 0 |
| FIXME comments | 0 |
| HACK comments | 0 |

The only occurrences are in documentation files referencing these terms as checklist items or rules. The `proc-macro-hack` entry in `Cargo.lock` is a Rust crate dependency name, not a code comment.

---

## 2. i18n Key Completeness

**Result: PASS — Fixed 6 hardcoded strings**

### Translation files

| File | Keys |
|------|------|
| `src/i18n/en.json` | 343 (339 originally + 4 added) |
| `src/i18n/zh.json` | 343 (339 originally + 4 added) |

### Key alignment: 100%

Zero keys missing on either side. All 339 original keys have matching entries in both languages. Identical JSON key tree structure.

### Hardcoded strings found and FIXED

| File | Line | Issue | Resolution |
|------|------|-------|------------|
| `App.tsx` | 280 | `已添加资料库并开始扫描: ${path}` | Now uses `t("common.libraryAddedAndScanning", { path })` |
| `App.tsx` | 284 | `添加资料库失败: ${error}` | Now uses `t("common.libraryAddFailed", { error })` |
| `Settings.tsx` | 303 | `"Failed to save"` | Now uses `t("common.saveFailed")` |
| `Settings.tsx` | 432 | `"Check if the Python backend is running."` | Now uses `t("common.backendCheckHint")` |
| `InlineError.tsx` | 26 | `"Retry"` fallback | Now uses `t("common.retry")` |

### New i18n keys added

| Key | English | Chinese |
|-----|---------|---------|
| `common.libraryAddedAndScanning` | Library added and scanning: {path} | 已添加资料库并开始扫描: {path} |
| `common.libraryAddFailed` | Failed to add library: {error} | 添加资料库失败: {error} |
| `common.saveFailed` | Failed to save | 保存失败 |
| `common.backendCheckHint` | Check if the Python backend is running. | 请检查 Python 后端是否正在运行。 |

### Remaining observations (acceptable)

- `Settings.tsx` lines 52, 298: `"图号"` is the default UG column name. This is a Chinese engineering term treated as a proper noun (like a brand name). It appears in both `zh.json` and `en.json` settings descriptions as-is. **No fix needed.**
- `LocaleToggle.tsx` line 18: `"EN"` / `"中"` — intentionally compact 1-2 character labels for the language switcher button. **No fix needed.**
- `Search.tsx` lines 1332: Error string matching against backend English messages (`"Model load failed"`, `"Missing Python package"`). These are backend error strings, not UI text. If the backend ever localizes errors, the matching logic will need updating. **Documented, no immediate fix needed.**

---

## 3. CSS Theme Variable Usage

**Result: PASS — Fixed 5 issues, documented remaining patterns**

### Design system

Theme variables defined in `src/styles/design-system.css` using `oklch()`:
- `:root` = light theme (lines 4-72)
- `[data-theme="dark"]` = dark theme (lines 75-99)

14 CSS files in `src/styles/`. 13 TSX components with inline styles checked.

### Issues FIXED

| File | Line | Issue | Resolution |
|------|------|-------|------------|
| `ErrorBoundary.tsx` | 62 | `var(--color-text-primary, #1a1a1a)` — wrong var name | Changed to `var(--fg)` |
| `ErrorBoundary.tsx` | 71 | `var(--color-text-secondary, #666)` — wrong var name | Changed to `var(--muted)` |
| `ErrorBoundary.tsx` | 87-88 | `#fff` + `var(--color-accent, #4a90d9)` — wrong var name | Changed to `var(--surface)` + `var(--accent)` |
| `global-search.css` | 101 | `var(--muted-muted)` — nonexistent variable | Changed to `var(--muted)` |
| `global-search.css` | 109 | `var(--muted-muted)` — nonexistent variable | Changed to `var(--muted)` |

### Remaining observations (acceptable patterns)

- **`color: white` on accent backgrounds**: ~15 places across `shell.css`, `search.css`, `search-detail.css`, `welcome.css`. This is a consistent pattern: white text on `--accent` or `--danger` colored backgrounds. The white text is appropriate for contrast on these saturated backgrounds regardless of theme. A future enhancement could add `--on-accent` and `--on-danger` variables, but the current pattern works correctly in both themes.
- **Hardcoded danger colors in `shell.css`** (`#e74c3c`, `#c0392b`): Used for reset-defaults danger button styling (lines 1883-1911). These are `--danger`-adjacent colors that don't change between themes (danger red looks similar in light/dark). Could use `--danger` with adjusted lightness, but current behavior is correct.
- **Toast CSS**: Self-contained custom properties (`--toast-success-bg`, etc.) with dark theme overrides. Clean pattern, no issues.
- **Image compare CSS**: Uses `oklch()` and `white` for dark overlay UI. Intentional, not theme-dependent.
- **`welcome.css`**: Uses `--fg-secondary` (not in design-system.css). Works because it's always used as a `var()` fallback. Minor technical debt.
- **`tooltip.css`**: Uses manually written `oklch()` values that match design tokens. Has explicit dark theme overrides. Works correctly.

---

## 4. Button Event Bindings

**Result: PASS — Zero orphaned buttons**

### Inventory

| Component | Buttons | All have handlers? |
|-----------|---------|-------------------|
| `Search.tsx` | 28 | Yes — all `onClick` bound to real functions |
| `Settings.tsx` | 21 | Yes — all `onClick` bound to real functions |
| `Library.tsx` | 7 | Yes — all `onClick` bound to real functions |
| `WindowControls.tsx` | 3 | Yes — minimize, maximize/restore, close |
| `SearchDetailPanel.tsx` | 10 | Yes — zoom, navigation, actions |
| `ImageCompareModal.tsx` | 5 | Yes — zoom, fit, reset, close |
| `GlobalSearch.tsx` | 2+ | Yes — open file/folder per result |
| `WelcomeGuide.tsx` | 7 | Yes — step navigation, browse, scan |
| `ShortcutsHelp.tsx` | 1 | Yes — close |
| `ErrorBoundary.tsx` | 1 | Yes — retry |
| `EmptyState.tsx` | 1 | Yes — action callback |
| `InlineError.tsx` | 1 | Yes — retry callback |
| `ContextMenu.tsx` | dynamic | Yes — mapped from items array |
| `Toast.tsx` | 1 (div) | Yes — dismiss on click |
| `ThemeToggle.tsx` | 1 | Yes — cycle theme |
| `LocaleToggle.tsx` | 1 | Yes — toggle locale |

**Total: ~90 interactive elements in production code. All have real handlers. Zero decorative/orphaned buttons.**

### Minor accessibility note

`Header.tsx` line 16: The global search trigger `<div>` has `onClick` but lacks `role="button"`, `tabIndex={0}`, and keyboard handlers (Enter/Space). Mouse users can click it; keyboard-only users cannot activate it. This is a minor a11y gap, not a functional bug. The global search is also accessible via `Ctrl+Shift+F` keyboard shortcut.

---

## 5. Tauri Command Consistency

**Result: PASS — Zero missing handlers, 4 orphaned commands documented**

### Frontend → Backend mapping: 100% valid

All 13 Tauri commands called from frontend have matching Rust `#[tauri::command]` registrations.  
All 35 `callBackend()` method invocations map to valid Python JSON-RPC handlers.  
Zero frontend calls to nonexistent commands.  
Parameter names are consistent (Tauri handles camelCase ↔ snake_case conversion).

### Orphaned backend code (documented, not removed)

**Rust Tauri commands (4) — registered but never called:**

| Command | Reason not called |
|---------|-------------------|
| `open_file` | Frontend uses `@tauri-apps/plugin-shell` `open()` instead (`systemService.ts`) |
| `open_folder` | Same as above |
| `save_window_state` | Window controls use direct Tauri window API, not this custom persistence |
| `load_window_state` | Same as above |

**Python backend methods (~10) — defined but unreachable from frontend UI:**

| Method | Notes |
|--------|-------|
| `db.addLog` | Python-internal helper uses direct SQL instead |
| `system.diagnostics` | Registered in routes, never called from UI |
| `errorReport.generate` | Only called by Python's startup error handler |
| `search.rebuildIndex` | UI calls `settings.rebuildIndex` instead |
| `ug.scan` / `ug.status` / `ug.clear_checkpoint` | Called internally during `scan_library` flow |
| `ocr.recognize` / `ocr.getStatus` / `ocr.setEnabled` | Called internally during scan pipeline |

These are internal implementation details or unused API surface. They don't cause bugs, but represent dead code. **Recommendation for future cleanup:** Either wire up the unused UI-facing methods (`system.diagnostics`, `search.rebuildIndex`) or remove them.

### API layer architecture

The project has a clean API layering:
- `src/services/ipc.ts` — central `callTauri()` and `callBackend()` wrappers
- `src/services/registry.ts` — service lifecycle management
- Domain service files (`libraryService.ts`, `searchService.ts`, etc.) — typed wrappers
- `src/services/exportService.ts` and `systemService.ts` — minor exceptions using raw invoke or shell plugin directly

---

## 6. Test Suite Verification

**Result: PASS — All tests green**

```
PASS  tsc --noEmit
PASS  eslint (1 warning, 0 errors)
PASS  vite build
PASS  cargo build
PASS  python syntax
PASS  mypy (16 source files)
PASS  pytest (120 tests)
PASS  vitest (20 tests)
```

`npm run check` → **8/8 PASS**

---

## Summary

| Check | Status | Issues Found | Issues Fixed |
|-------|--------|-------------|--------------|
| 1. TODO/FIXME/HACK | CLEAN | 0 | 0 |
| 2. i18n completeness | FIXED | 6 hardcoded strings | 6 (4 new keys added) |
| 3. CSS theme variables | FIXED | 5 wrong/missing vars | 5 (2 files) |
| 4. Button event bindings | CLEAN | 0 (1 minor a11y note) | 0 |
| 5. Tauri command consistency | CLEAN | 0 mismatches (14 orphaned documented) | 0 |
| 6. Test suite | PASS | 0 failures | 0 |

**Overall verdict: Project is release-ready.**  
All critical issues (hardcoded strings, wrong CSS variables) have been fixed.  
Remaining observations are either acceptable patterns or documented technical debt for future consideration.
