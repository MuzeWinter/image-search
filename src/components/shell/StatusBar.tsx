import { useI18n } from "../../i18n/context";
import { useServiceQuery } from "../../stores/hooks";
import type { SystemStats } from "../../services/types";

export function StatusBar() {
  const { t } = useI18n();
  const { data: stats } = useServiceQuery<SystemStats>(
    "dbService",
    "db.getStats",
  );

  return (
    <footer className="statusbar">
      <span className="statusbar-item">
        {t("statusBar.libraries")}: {stats?.libraries ?? 0}
      </span>
      <span className="statusbar-item">
        {t("statusBar.images")}: {stats?.images ?? 0}
      </span>
      <span className="statusbar-spacer" />
      <span className="statusbar-item statusbar-tasks">
        {t("statusBar.tasks")}: {t("statusBar.idle")}
      </span>
    </footer>
  );
}
