import { Suspense, lazy, useCallback } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./i18n/context";
import { ToastProvider } from "./contexts/ToastContext";
import { ToastContainer } from "./components/shared/Toast";
import { WelcomeGuide, useWelcomeState } from "./components/shared/WelcomeGuide";
import { AppShell } from "./AppShell";
import { Skeleton } from "./components/shared/Skeleton";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";
import * as libraryService from "./services/libraryService";
import * as scanService from "./services/scanService";

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

export function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <BrowserRouter>
            <ErrorBoundary>
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
