import { useI18n } from "../i18n/context";
import { Skeleton } from "../components/shared/Skeleton";

export default function MatchManagement() {
  const { t } = useI18n();
  return (
    <div className="page-placeholder">
      <h2>{t("sidebar.nav.matchManagement")}</h2>
      <Skeleton variant="card" height={200} />
      <div style={{ marginTop: 16 }}>
        <Skeleton variant="text" lines={4} />
      </div>
    </div>
  );
}
