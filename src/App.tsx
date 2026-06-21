import { Suspense, lazy, useCallback, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./i18n/context";
import { useI18n } from "./i18n/context";
import { ToastProvider, useToast } from "./contexts/ToastContext";
import { ToastContainer } from "./components/shared/Toast";
import { AppShell } from "./AppShell";
import { Skeleton } from "./components/shared/Skeleton";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { SplashScreen } from "./components/SplashScreen";
import { useWelcomeState } from "./hooks/useWelcomeState";
import { pendingChangesAtom, splashStateAtom, startupSearchPathAtom, invalidPathsAtom, watchActiveAtom, watchPathCountAtom } from "./stores/atoms";
import * as libraryService from "./services/libraryService";
import * as scanService from "./services/scanService";
import * as searchService from "./services/searchService";
import * as settingsService from "./services/settingsService";
import { listen } from "@tauri-apps/api/event";
import { callTauri } from "./services/ipc";
import type { CheckChangesResult } from "./services/types";

const WelcomeGuide = lazy(() => import("./components/shared/WelcomeGuide").then(m => ({ default: m.WelcomeGuide })));
const Search = lazy(() => import("./pages/Search"));
const Library = lazy(() => import("./pages/Library"));
const Settings = lazy(() => import("./pages/Settings"));

function PageFallback() {
  return (
    <div style={{ padding: 24 }}>
      <Skeleton variant="card" height={200} />
      <div style={{ marginTop: 16 }}>
        <Skeleton variant="text" lines={4} />
      </div>
    </div>
  );
}

function suspense(Component: React.LazyExoticComponent<() => JSX.Element>) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageFallback />}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
}

function WelcomeGate() {
  const [show, dismiss] = useWelcomeState();

  const handleAddLibrary = useCallback(async (path: string) => {
    return await libraryService.add(path);
  }, []);

  const handleScan = useCallback(async (path: string) => {
    const libs = await libraryService.list();
    const lib = libs.find((l: { path: string }) => l.path === path);
    if (lib) {
      await settingsService.syncScanConfig();
      await scanService.startScan(lib.id, lib.path);
    }
  }, []);

  if (!show) return null;

  return (
    <Suspense fallback={null}>
      <WelcomeGuide
        onDone={dismiss}
        onAddLibrary={handleAddLibrary}
        onScan={handleScan}
      />
    </Suspense>
  );
}

function StartupChangeDetector() {
  const setPendingChanges = useSetAtom(pendingChangesAtom);

  useEffect(() => {
    let cancelled = false;

    async function detect() {
      try {
        const libs = await libraryService.list();
        if (cancelled || libs.length === 0) return;

        const aggregated: CheckChangesResult = {
          added: 0,
          removed: 0,
          modified: 0,
          moved: 0,
          has_changes: false,
          total_files: 0,
        };

        for (const lib of libs) {
          if (cancelled) return;
          try {
            const result = await scanService.checkChanges(lib.id);
            if (result.error) continue;
            aggregated.added += result.added;
            aggregated.removed += result.removed;
            aggregated.modified += result.modified;
            aggregated.moved += result.moved;
            aggregated.total_files += result.total_files;
          } catch {
            // Skip libraries that fail the check
          }
        }

        aggregated.has_changes =
          aggregated.added +
            aggregated.removed +
            aggregated.modified +
            aggregated.moved >
          0;

        if (!cancelled) {
          setPendingChanges(aggregated);
        }
      } catch {
        // No libraries yet or service not ready — that's fine
      }
    }

    // Delay slightly so the UI renders first, then run detection
    const timer = setTimeout(detect, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [setPendingChanges]);

  return null;
}

function StartupPathValidator() {
  const setInvalidPaths = useSetAtom(invalidPathsAtom);
  const { addToast } = useToast();
  const { t } = useI18n();

  useEffect(() => {
    let cancelled = false;

    async function validate() {
      try {
        const libs = await libraryService.list();
        if (cancelled || libs.length === 0) return;

        const invalid = new Set<number>();
        const invalidPaths: string[] = [];

        for (const lib of libs) {
          if (cancelled) return;
          try {
            const res = await callTauri<{ exists: boolean }>("check_path", { path: lib.path });
            if (!res.exists) {
              invalid.add(lib.id);
              invalidPaths.push(lib.path);
            }
          } catch {
            // Tauri command unavailable — skip
          }
        }

        if (cancelled) return;

        if (invalid.size > 0) {
          setInvalidPaths(invalid);
          addToast("warning", t("libraries.pathNotFoundDetail", { count: invalid.size }));
          for (const p of invalidPaths) {
            addToast("warning", p);
          }
        }
      } catch {
        // No libraries or service not ready — fine
      }
    }

    const timer = setTimeout(validate, 1000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [setInvalidPaths, addToast, t]);

  return null;
}

function ModelLoadingGate() {
  const setSplash = useSetAtom(splashStateAtom);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const status = await searchService.getModelStatus();
        if (cancelled) return;

        if (status.status === "ready") return;

        setSplash({
          visible: true,
          percent: status.percent,
          message: status.message || "",
        });

        if (status.status === "error") {
          // Model errored — hide splash after a brief display
          const timer = setTimeout(() => {
            if (!cancelled) setSplash({ visible: false, percent: 0, message: "" });
          }, 3000);
          return () => clearTimeout(timer);
        }

        // Poll until ready
        pollRef.current = setInterval(async () => {
          if (cancelled) return;
          try {
            const s = await searchService.getModelStatus();
            if (cancelled) return;
            setSplash({ visible: true, percent: s.percent, message: s.message || "" });
            if (s.status === "ready" || s.status === "error") {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              if (s.status === "ready") {
                setTimeout(() => {
                  if (!cancelled) setSplash({ visible: false, percent: 0, message: "" });
                }, 600);
              } else {
                setTimeout(() => {
                  if (!cancelled) setSplash({ visible: false, percent: 0, message: "" });
                }, 3000);
              }
            }
          } catch {
            // Backend not reachable — ignore
          }
        }, 500);
      } catch {
        // Backend not ready yet — that's fine, it'll be checked on first search
      }
    }

    const timer = setTimeout(check, 400);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
      clearTimeout(timer);
    };
  }, [setSplash]);

  return null;
}

function StartupArgHandler() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { t } = useI18n();
  const setStartupSearchPath = useSetAtom(startupSearchPathAtom);
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    async function handle() {
      let args: { scanPath?: string | null; searchPath?: string | null };
      try {
        args = await callTauri<{ scanPath: string | null; searchPath: string | null }>(
          "get_startup_args",
        );
      } catch {
        return;
      }

      if (args.scanPath) {
        try {
          const lib = await libraryService.add(args.scanPath);
          addToast("success", t("common.libraryAddedAndScanning", { path: args.scanPath }));
          await settingsService.syncScanConfig();
          await scanService.startScan(lib.id, lib.path);
        } catch (e) {
          addToast("error", t("common.libraryAddFailed", { error: e instanceof Error ? e.message : String(e) }));
        }
      }

      if (args.searchPath) {
        setStartupSearchPath(args.searchPath);
        navigate("/");
      }
    }

    const timer = setTimeout(handle, 600);
    return () => clearTimeout(timer);
  }, [addToast, navigate, setStartupSearchPath]);

  return null;
}

function FolderWatchManager() {
  const setWatchActive = useSetAtom(watchActiveAtom);
  const setWatchPathCount = useSetAtom(watchPathCountAtom);

  // On startup, restore watch if setting is enabled
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const enabled = await settingsService.get("folder_watch_enabled");
        if (cancelled || enabled !== "true") return;

        const libs = await libraryService.list();
        if (cancelled || libs.length === 0) return;

        const paths = libs.map((l) => l.path);
        const result = await scanService.startFolderWatch(paths);
        if (cancelled) return;
        if (result.active) {
          setWatchActive(true);
          setWatchPathCount(result.paths.length);
        }
      } catch {
        // Folder watch not available or backend not ready
      }
    }

    const timer = setTimeout(init, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [setWatchActive, setWatchPathCount]);

  // Listen for watch status changes
  useEffect(() => {
    const unlisten = listen<{ active: boolean; paths: string[] }>(
      "watch-status-changed",
      (event) => {
        setWatchActive(event.payload.active);
        setWatchPathCount(event.payload.paths.length);
      },
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [setWatchActive, setWatchPathCount]);

  // Listen for file changes → trigger auto-scan
  useEffect(() => {
    let scanInProgress = false;

    const unlisten = listen("file-change-detected", async () => {
      if (scanInProgress) return;

      try {
        scanInProgress = true;
        const libs = await libraryService.list();

        for (const lib of libs) {
          if (lib.status === "ready" || lib.status === "idle") {
            // Pause watch briefly during scan to avoid cascade
            await scanService.stopFolderWatch().catch(() => {});
            try {
              await settingsService.syncScanConfig();
              await scanService.startScan(lib.id, lib.path);
            } finally {
              // Resume watch after scan
              if (libs.length > 0) {
                const paths = libs.map((l) => l.path);
                await scanService.startFolderWatch(paths).catch(() => {});
              }
            }
          }
        }
      } catch {
        // Silently fail — scan errors shown via scan progress UI
      } finally {
        scanInProgress = false;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return null;
}

export function App() {
  const splash = useAtomValue(splashStateAtom);

  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <StartupChangeDetector />
              <StartupPathValidator />
              <ModelLoadingGate />
              <StartupArgHandler />
              <FolderWatchManager />
              <WelcomeGate />
              <Routes>
                <Route path="/" element={<AppShell />}>
                  <Route index element={suspense(Search)} />
                  <Route path="library" element={suspense(Library)} />
                  <Route path="settings" element={suspense(Settings)} />
                </Route>
              </Routes>
            </ErrorBoundary>
          </BrowserRouter>
          <ToastContainer />
          {splash.visible && (
            <SplashScreen percent={splash.percent} message={splash.message} />
          )}
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
