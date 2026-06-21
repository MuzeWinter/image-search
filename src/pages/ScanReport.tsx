import { useI18n } from "../i18n/context";
import { useServiceQuery } from "../stores/hooks";
import type { ScanHistory } from "../services/types";
import { Skeleton } from "../components/shared/Skeleton";
import { InlineError } from "../components/shared/InlineError";

export default function ScanReport() {
  const { t } = useI18n();

  const {
    data: history,
    loading,
    error,
    refetch,
  } = useServiceQuery<ScanHistory[]>("dbService", "db.query", {
    sql: "SELECT * FROM scan_history ORDER BY scanned_at DESC LIMIT 50",
  });

  if (error) {
    return (
      <div className="page-placeholder">
        <h2>{t("sidebar.nav.scanReport")}</h2>
        <InlineError message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="scan-report-page">
      <h2 className="page-title">{t("sidebar.nav.scanReport")}</h2>

      {loading ? (
        <Skeleton variant="card" height={240} />
      ) : history && history.length > 0 ? (
        <div className="scan-report-list">
          {history.map((scan) => (
            <div key={scan.id} className="scan-report-card">
              <div className="scan-report-header">
                <span className="scan-report-id">
                  {t("scanReport.scanId", { id: scan.id })}
                </span>
                <span className="scan-report-time text-muted">
                  {scan.scanned_at}
                </span>
                <span className="scan-report-duration">
                  {scan.duration_sec}s
                </span>
              </div>

              <div className="scan-report-stats">
                <div className="scan-stat">
                  <span className="scan-stat-num added">+{scan.added}</span>
                  <span className="scan-stat-label">{t("scanReport.new")}</span>
                </div>
                <div className="scan-stat">
                  <span className="scan-stat-num modified">{scan.modified}</span>
                  <span className="scan-stat-label">{t("scanReport.modified")}</span>
                </div>
                <div className="scan-stat">
                  <span className="scan-stat-num removed">{scan.removed}</span>
                  <span className="scan-stat-label">{t("scanReport.deleted")}</span>
                </div>
                <div className="scan-stat">
                  <span className="scan-stat-num moved">{scan.moved}</span>
                  <span className="scan-stat-label">{t("scanReport.moved")}</span>
                </div>
                {scan.errors > 0 && (
                  <div className="scan-stat">
                    <span className="scan-stat-num error">{scan.errors}</span>
                    <span className="scan-stat-label">{t("scanReport.errors")}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">{t("scanReport.emptyIcon")}</div>
          <div className="empty-state-title">{t("scanReport.emptyTitle")}</div>
          <div className="empty-state-description">{t("scanReport.emptyDesc")}</div>
        </div>
      )}
    </div>
  );
}
