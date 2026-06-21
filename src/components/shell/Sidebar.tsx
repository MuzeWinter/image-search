import { NavLink } from "react-router-dom";
import { useI18n } from "../../i18n/context";

interface NavItem {
  key: string;
  path: string;
}

const navItems: NavItem[] = [
  { key: "search", path: "/" },
  { key: "library", path: "/library" },
  { key: "settings", path: "/settings" },
];

export function Sidebar() {
  const { t } = useI18n();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">{t("sidebar.brand")}</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            end={item.path === "/"}
            className={({ isActive }) =>
              `sidebar-link${isActive ? " active" : ""}`
            }
          >
            <span className="sidebar-link-text">
              {t(`sidebar.nav.${item.key}`)}
            </span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        {t("sidebar.version")} 2.0
      </div>
    </aside>
  );
}
