import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { I18nProvider } from "./i18n/context";
import { AppShell } from "./AppShell";
import { Skeleton } from "./components/shared/Skeleton";

const Home = lazy(() => import("./pages/Home"));
const Search = lazy(() => import("./pages/Search"));
const ImageLibrary = lazy(() => import("./pages/ImageLibrary"));
const Library = lazy(() => import("./pages/Library"));
const ScanReport = lazy(() => import("./pages/ScanReport"));
const MatchManagement = lazy(() => import("./pages/MatchManagement"));
const CadFiles = lazy(() => import("./pages/CadFiles"));
const ExcelRecords = lazy(() => import("./pages/ExcelRecords"));
const PdfFiles = lazy(() => import("./pages/PdfFiles"));
const Tags = lazy(() => import("./pages/Tags"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Settings = lazy(() => import("./pages/Settings"));
const Changelog = lazy(() => import("./pages/Changelog"));

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
    <Suspense fallback={<PageFallback />}>
      <Component />
    </Suspense>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AppShell />}>
              <Route index element={suspense(Home)} />
              <Route path="search" element={suspense(Search)} />
              <Route path="image-library" element={suspense(ImageLibrary)} />
              <Route path="library" element={suspense(Library)} />
              <Route path="scan-report" element={suspense(ScanReport)} />
              <Route path="match-management" element={suspense(MatchManagement)} />
              <Route path="cad-files" element={suspense(CadFiles)} />
              <Route path="excel-records" element={suspense(ExcelRecords)} />
              <Route path="pdf-files" element={suspense(PdfFiles)} />
              <Route path="tags" element={suspense(Tags)} />
              <Route path="favorites" element={suspense(Favorites)} />
              <Route path="settings" element={suspense(Settings)} />
              <Route path="changelog" element={suspense(Changelog)} />
            </Route>
          </Routes>
        </BrowserRouter>
      </I18nProvider>
    </ThemeProvider>
  );
}
