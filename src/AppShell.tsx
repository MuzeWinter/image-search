import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/shell/Sidebar";
import { Header } from "./components/shell/Header";
import { StatusBar } from "./components/shell/StatusBar";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";

export function AppShell() {
  useKeyboardShortcuts();

  return (
    <div className="app-shell">
      <Sidebar />
      <Header />
      <main className="app-content">
        <Outlet />
      </main>
      <StatusBar />
    </div>
  );
}
