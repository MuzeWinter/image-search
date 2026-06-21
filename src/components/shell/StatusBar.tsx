import { useI18n } from "../../i18n/context";

export function StatusBar() {
  const { t } = useI18n();

  return (
    <footer className="statusbar">
      <span className="statusbar-item">
        {t("statusBar.libraries")}: 0
      </span>
      <span className="statusbar-item">
        {t("statusBar.images")}: 0
      </span>
      <span className="statusbar-spacer" />
      <span className="statusbar-item statusbar-tasks">
        {t("statusBar.tasks")}: {t("statusBar.idle")}
      </span>
    </footer>
  );
}
