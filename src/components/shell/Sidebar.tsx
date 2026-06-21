import { NavLink } from "react-router-dom";
import { useI18n } from "../../i18n/context";

interface NavItem {
  key: string;
  path: string;
  group: string;
}

const navItems: NavItem[] = [
  { key: "search", path: "/search", group: "search" },
  { key: "imageLibrary", path: "/image-library", group: "browse" },
  { key: "cadFiles", path: "/cad-files", group: "browse" },
  { key: "excelRecords", path: "/excel-records", group: "browse" },
  { key: "pdfFiles", path: "/pdf-files", group: "browse" },
  { key: "library", path: "/library", group: "manage" },
  { key: "scanReport", path: "/scan-report", group: "manage" },
  { key: "matchManagement", path: "/match-management", group: "manage" },
  { key: "tags", path: "/tags", group: "classify" },
  { key: "favorites", path: "/favorites", group: "classify" },
  { key: "settings", path: "/settings", group: "system" },
  { key: "changelog", path: "/changelog", group: "system" },
];

const groupOrder = ["search", "browse", "manage", "classify", "system"];

export function Sidebar() {
  const { t } = useI18n();

  const grouped = groupOrder.map((groupKey) => ({
    key: groupKey,
    label: t(`sidebar.groups.${groupKey}`),
    items: navItems.filter((item) => item.group === groupKey),
  }));

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">{t("sidebar.brand")}</div>
      <nav className="sidebar-nav">
        {grouped.map((group) => (
          <div key={group.key} className="sidebar-group">
            <div className="sidebar-group-label">{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.key}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-link${isActive ? " active" : ""}`
                }
              >
                <span className="sidebar-link-text">
                  {t(`sidebar.nav.${item.key}`)}
                </span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-footer">
        {t("sidebar.version")} 2.0
      </div>
    </aside>
  );
}
