import { Suspense, lazy, useCallback, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useSetAtom } from "jotai";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./i18n/context";
import { ToastProvider } from "./contexts/ToastContext";
import { ToastContainer } from "./components/shared/Toast";
import { WelcomeGuide, useWelcomeState } from "./components/shared/WelcomeGuide";
import { AppShell } from "./AppShell";
import { Skeleton } from "./components/shared/Skeleton";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import { pendingChangesAtom } from "./stores/atoms";
import * as libraryService from "./services/libraryService";
import * as scanService from "./services/scanService";
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

export function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <StartupChangeDetector />
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
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
