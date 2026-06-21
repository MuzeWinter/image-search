import { Outlet } from "react-router-dom";
import { Sidebar } from "./components/shell/Sidebar";
import { Header } from "./components/shell/Header";
import { StatusBar } from "./components/shell/StatusBar";

export function AppShell() {
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
