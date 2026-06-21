import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./i18n/context";
import { AppShell } from "./AppShell";
import { Skeleton } from "./components/shared/Skeleton";
import { ErrorBoundary } from "./components/shared/ErrorBoundary";

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

export function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<AppShell />}>
                <Route index element={suspense(Search)} />
                <Route path="libraries" element={suspense(Library)} />
                <Route path="settings" element={suspense(Settings)} />
              </Route>
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}
