import { Suspense, lazy, useCallback, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAtomValue, useSetAtom } from "jotai";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./i18n/context";
import { ToastProvider } from "./contexts/ToastContext";
import { ToastContainer } from "./components/shared/Toast";
import { WelcomeGuide, useWelcomeState } from "./components/shared/WelcomeGuide";
import { AppShell } from "./AppShell";
import { Skeleton } from "./components/shared/Skeleton";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { SplashScreen } from "./components/SplashScreen";
import { pendingChangesAtom, splashStateAtom } from "./stores/atoms";
import * as libraryService from "./services/libraryService";
import * as scanService from "./services/scanService";
import * as searchService from "./services/searchService";
import type { CheckChangesResult } from "./services/types";

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
      await scanService.startScan(lib.id, lib.path);
    }
  }, []);

  if (!show) return null;

  return (
    <WelcomeGuide
      onDone={dismiss}
      onAddLibrary={handleAddLibrary}
      onScan={handleScan}
    />
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

export function App() {
  const splash = useAtomValue(splashStateAtom);

  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <StartupChangeDetector />
              <ModelLoadingGate />
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
