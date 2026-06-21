# Performance Audit Report — v2-80

**Generated:** 2026-06-21
**Project:** zoobet-image-search v0.1.0
**Build tool:** Vite 5 + Tauri 2

---

## 1. Build Output Summary

| Metric | Raw | Gzip |
|--------|-----|------|
| Total JS (8 chunks) | 336.1 KB | 107.3 KB |
| Total CSS (1 bundle) | 74.1 KB | 11.5 KB |
| HTML entry | 0.9 KB | — |
| **Grand total** | **411.1 KB** | **~119 KB** |
| Image assets | 0 | 0 |

**Verdict:** Total gzip size ~119 KB, well under the 2 MB threshold. **Pass.**

---

## 2. Per-File Breakdown

### JavaScript Chunks

| Chunk | Raw | Gzip | Category |
|-------|-----|------|----------|
| `vendor-router-C4cUWPmk.js` | 163.6 KB | 53.4 KB | react-router-dom (vendor) |
| `page-search-CR4NZRgb.js` | 47.5 KB | 13.3 KB | Search page (lazy) |
| `chunk-shared-Dd8gOUBY.js` | 45.6 KB | 16.9 KB | Shared app code |
| `page-settings-CP9EhE3q.js` | 20.2 KB | 5.0 KB | Settings page (lazy) |
| `vendor-tauri-BSj8gmzq.js` | 19.7 KB | 5.1 KB | @tauri-apps/api (vendor) |
| `page-library-B6G93TBp.js` | 15.0 KB | 4.4 KB | Library page (lazy) |
| `index-M8UJWwD4.js` | 12.8 KB | 4.4 KB | Main entry |
| `vendor-jotai-BL9y0vvS.js` | 11.5 KB | 4.7 KB | jotai state mgmt (vendor) |

**Largest chunk:** `vendor-router` at 53.4 KB gzip. This is react-router-dom, which is a core dependency. Pages are code-split (lazy-loaded), and each page chunk is well under 15 KB gzip.

### CSS

| Chunk | Raw | Gzip |
|-------|-----|------|
| `index-rMRx06fW.css` | 74.1 KB | 11.5 KB |

CSS is bundled into a single file. 11.5 KB gzip is lightweight.

### Image Assets

No image or font assets in the build output. The app uses only CSS-based styling.

---

## 3. Source Code Statistics

### File counts

| Category | Count |
|----------|-------|
| `.tsx` (components, pages, contexts) | 28 |
| `.ts` (services, hooks, stores) | 15 |
| `.css` (stylesheets) | 12 |
| `.json` (i18n: en + zh) | 2 |
| `.rs` (Rust backend) | 2 |
| **Total source files** | **59** |

### Components

| Group | Count | Files |
|-------|-------|-------|
| Shared UI components | 14 | Skeleton, ErrorBoundary, InlineError, Toast, WelcomeGuide, ContextMenu, EmptyState, LazyThumbnail, ThemeToggle, LocaleToggle, Tooltip, ImageCompareModal, GlobalSearch, ShortcutsHelp |
| Shell components | 4 | Sidebar, WindowControls, StatusBar, Header |
| Pages (lazy-loaded) | 3 | Search, Settings, Library |
| Context providers | 3 | ThemeContext, ToastContext, i18n context |
| App-level + entry | 4 | App, AppShell, SplashScreen, main |

**Total React components: 28** (including pages and contexts)

### Hooks

| Hook | File |
|------|------|
| `useIntersectionObserver` | `src/hooks/useIntersectionObserver.ts` |
| `useKeyboardShortcuts` | `src/hooks/useKeyboardShortcuts.ts` |

**Total hooks: 2**

### Services

| Service | File |
|---------|------|
| Registry | `src/services/registry.ts` |
| IPC layer | `src/services/ipc.ts` |
| Library service | `src/services/libraryService.ts` |
| System service | `src/services/systemService.ts` |
| Search history store | `src/services/searchHistoryStore.ts` |
| Database service | `src/services/dbService.ts` |
| Type definitions | `src/services/types.ts` |
| Search service | `src/services/searchService.ts` |
| Scan service | `src/services/scanService.ts` |
| Settings service | `src/services/settingsService.ts` |

**Total services: 10** (9 services + 1 types definition)

### Rust Backend

| File | Lines |
|------|-------|
| `src-tauri/src/lib.rs` | 2 |
| `src-tauri/src/main.rs` | 990 |
| **Total** | **992** |

---

## 4. Dependency Footprint

| Dependency | Purpose | Gzip (approx.) |
|------------|---------|-----------------|
| react + react-dom | UI framework | embedded in entry |
| react-router-dom ^6 | Routing + lazy pages | 53.4 KB |
| jotai ^2 | State management | 4.7 KB |
| @tauri-apps/api ^2 | Desktop bridge | 5.1 KB |

**Total runtime dependencies: 4 packages.** No unnecessary dependencies.

---

## 5. Build Optimization Assessment

| Check | Status |
|-------|--------|
| Code splitting (lazy pages) | Pass — 3 page chunks |
| Vendor chunking | Pass — 3 vendor chunks |
| CSS bundling | Pass — single file, small |
| No unused heavy deps | Pass — only 4 runtime deps |
| Gzip total < 2 MB | Pass — ~119 KB |
| Image optimization | N/A — no image assets |
| Tree shaking | Active (Vite/Rollup default) |

---

## 6. Summary

The build is lean and well-structured:
- **Total gzip: ~119 KB** — would load in under 1 second on a 3G connection
- Pages are lazy-loaded via react-router, keeping the entry point small (4.4 KB gzip)
- The single largest chunk (react-router-dom at 53.4 KB gzip) is a core dependency, shared across pages
- CSS is bundled efficiently at 11.5 KB gzip
- No image or font bloat
- Only 4 runtime npm dependencies

**No performance regressions detected. Build passes all checks.**
