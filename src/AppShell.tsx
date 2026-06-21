import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./components/shell/Sidebar";
import { Header } from "./components/shell/Header";
import { StatusBar } from "./components/shell/StatusBar";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

export function AppShell() {
  useKeyboardShortcuts();
  const location = useLocation();

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
    </div>
  );
}
