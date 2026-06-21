import { Link } from "react-router-dom";
import { useI18n } from "../i18n/context";
import { Skeleton } from "../components/shared/Skeleton";

interface NavCard {
  key: string;
  path: string;
  icon: string;
}

const navCards: NavCard[] = [
  { key: "search", path: "/search", icon: "🔍" },
  { key: "imageLibrary", path: "/image-library", icon: "🖼" },
  { key: "cadFiles", path: "/cad-files", icon: "📐" },
  { key: "excelRecords", path: "/excel-records", icon: "📊" },
  { key: "pdfFiles", path: "/pdf-files", icon: "📄" },
  { key: "library", path: "/library", icon: "📁" },
  { key: "scanReport", path: "/scan-report", icon: "📋" },
  { key: "matchManagement", path: "/match-management", icon: "🔗" },
  { key: "tags", path: "/tags", icon: "🏷" },
  { key: "favorites", path: "/favorites", icon: "⭐" },
  { key: "settings", path: "/settings", icon: "⚙" },
  { key: "changelog", path: "/changelog", icon: "📝" },
];

export default function Home() {
  const { t } = useI18n();

  return (
    <div className="home-page">
      <div className="home-welcome">
        <div className="home-welcome-text">
          <h1 className="home-welcome-title">{t("home.welcome")}</h1>
          <p className="home-welcome-subtitle">{t("home.subtitle")}</p>
        </div>
        <div className="home-stats">
          <div className="home-stat">
            <div className="home-stat-value">
              <Skeleton variant="text" width={48} />
            </div>
            <div className="home-stat-label">{t("statusBar.libraries")}</div>
          </div>
          <div className="home-stat">
            <div className="home-stat-value">
              <Skeleton variant="text" width={48} />
            </div>
            <div className="home-stat-label">{t("statusBar.images")}</div>
          </div>
          <div className="home-stat">
            <div className="home-stat-value">
              <Skeleton variant="text" width={48} />
            </div>
            <div className="home-stat-label">Excel</div>
          </div>
          <div className="home-stat">
            <div className="home-stat-value">
              <Skeleton variant="text" width={48} />
            </div>
            <div className="home-stat-label">CAD/UG</div>
          </div>
        </div>
      </div>

      <h2 className="home-section-title">{t("home.quickLinks")}</h2>
      <div className="home-cards">
        {navCards.map((card) => (
          <Link key={card.key} to={card.path} className="home-card">
            <span className="home-card-icon">{card.icon}</span>
            <span className="home-card-title">
              {t(`sidebar.nav.${card.key}`)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
