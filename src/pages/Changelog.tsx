import { useI18n } from "../i18n/context";
import { useServiceQuery } from "../stores/hooks";
import type { ChangeLog } from "../services/types";
import { Skeleton } from "../components/shared/Skeleton";
import { InlineError } from "../components/shared/InlineError";

const changeTypeLabel: Record<string, { zh: string; en: string }> = {
  added: { zh: "新增", en: "Added" },
  removed: { zh: "删除", en: "Removed" },
  modified: { zh: "修改", en: "Modified" },
  moved: { zh: "移动", en: "Moved" },
};

export default function Changelog() {
  const { t, locale } = useI18n();

  const {
    data: logs,
    loading,
    error,
    refetch,
  } = useServiceQuery<ChangeLog[]>("dbService", "db.query", {
    sql: "SELECT * FROM change_logs ORDER BY created_at DESC LIMIT 100",
  });

  if (error) {
    return (
      <div className="page-placeholder">
        <h2>{t("sidebar.nav.changelog")}</h2>
        <InlineError message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="changelog-page">
      <h2 className="page-title">{t("sidebar.nav.changelog")}</h2>

      {loading ? (
        <Skeleton variant="card" height={240} />
      ) : logs && logs.length > 0 ? (
        <div className="changelog-list">
          {logs.map((log) => (
            <div key={log.id} className={`changelog-item changelog-${log.change_type}`}>
              <div className="changelog-meta">
                <span className={`changelog-badge changelog-badge-${log.change_type}`}>
                  {changeTypeLabel[log.change_type]?.[locale] ?? log.change_type}
                </span>
                <span className="changelog-time text-muted text-xs">
                  {log.created_at}
                </span>
              </div>
              <div className="changelog-path text-mono truncate" title={log.file_path}>
                {log.file_path || "-"}
              </div>
              {log.old_value && log.new_value && log.change_type === "moved" && (
                <div className="changelog-detail text-xs text-muted">
                  {log.old_value} → {log.new_value}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-state-icon">{t("changelog.emptyIcon")}</div>
          <div className="empty-state-title">{t("changelog.emptyTitle")}</div>
          <div className="empty-state-description">{t("changelog.emptyDesc")}</div>
        </div>
      )}
    </div>
  );
}
