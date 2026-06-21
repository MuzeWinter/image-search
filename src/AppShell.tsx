import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useAtomValue } from "jotai";
import { Sidebar } from "./components/shell/Sidebar";
import { Header } from "./components/shell/Header";
import { StatusBar } from "./components/shell/StatusBar";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useI18n } from "./i18n/context";
import { scanPhaseAtom } from "./stores/atoms";
import GlobalSearch from "./components/shared/GlobalSearch";
import ShortcutsHelp from "./components/shared/ShortcutsHelp";

export function AppShell() {
  useKeyboardShortcuts();
  const location = useLocation();
  const { t } = useI18n();
  const scanPhase = useAtomValue(scanPhaseAtom);

  useEffect(() => {
    const brand = t("sidebar.brand");
    let pageName: string;

    if (location.pathname === "/") {
      pageName = t("sidebar.nav.search");
    } else if (location.pathname.startsWith("/library")) {
      pageName = t("sidebar.nav.library");
    } else if (location.pathname.startsWith("/settings")) {
      pageName = t("settings.title");
    } else {
      pageName = "";
    }

    const scanning = location.pathname.startsWith("/library") && scanPhase === "scanning";
    const prefix = scanning ? `[${t("libraries.scanning")}] ` : "";

    document.title = `${prefix}${brand} — ${pageName}`;
  }, [location.pathname, t, scanPhase]);

  return (
    <div className="app-shell">
      <Sidebar />
      <Header />
      <main className="app-content">
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>
      <StatusBar />
      <GlobalSearch />
      <ShortcutsHelp />
    </div>
  );
}
