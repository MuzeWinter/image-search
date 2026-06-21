import { useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/context";
import { useServiceQuery } from "../../stores/hooks";
import { pendingChangesAtom, invalidPathsAtom, watchActiveAtom, watchPathCountAtom } from "../../stores/atoms";
import * as libraryService from "../../services/libraryService";
import * as scanService from "../../services/scanService";
import type { SystemStats } from "../../services/types";

export function StatusBar() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data: stats } = useServiceQuery<SystemStats>(
    "dbService",
    "db.getStats",
  );
  const pendingChanges = useAtomValue(pendingChangesAtom);
  const setPendingChanges = useSetAtom(pendingChangesAtom);
  const invalidPaths = useAtomValue(invalidPathsAtom);
  const watchActive = useAtomValue(watchActiveAtom);
  const watchPathCount = useAtomValue(watchPathCountAtom);

  const hasChanges =
    pendingChanges &&
    !pendingChanges.error &&
    pendingChanges.has_changes;

  const totalChanges = pendingChanges
    ? pendingChanges.added +
      pendingChanges.removed +
      pendingChanges.modified +
      pendingChanges.moved
    : 0;

  const invalidCount = invalidPaths.size;

  const handleIncrementalScan = useCallback(async () => {
    try {
      const libs = await libraryService.list();
      for (const lib of libs) {
        if (lib.status === "ready" || lib.status === "idle") {
          await scanService.startScan(lib.id, lib.path);
        }
      }
      setPendingChanges(null);
    } catch {
      // Silently fail — scan errors are shown by scan progress UI
    }
  }, [setPendingChanges]);

  const handleGoToLibrary = useCallback(() => {
    navigate("/library");
  }, [navigate]);

  return (
    <footer className="statusbar">
      <span className="statusbar-item">
        {t("statusBar.libraries")}: {stats?.libraries ?? 0}
      </span>
      <span className="statusbar-item">
        {t("statusBar.images")}: {stats?.images ?? 0}
      </span>
      <span className="statusbar-spacer" />
      {invalidCount > 0 && (
        <button
          className="statusbar-item statusbar-warning"
          onClick={handleGoToLibrary}
          title={t("statusBar.pathsMissingHint")}
        >
          {t("statusBar.pathsMissing", { count: invalidCount })}
        </button>
      )}
      {watchActive && (
        <span className="statusbar-item statusbar-watching" title={t("settings.autoMonitorDesc")}>
          {t("statusBar.watching", { count: watchPathCount })}
        </span>
      )}
      {hasChanges ? (
        <button
          className="statusbar-item statusbar-changes"
          onClick={handleIncrementalScan}
          title={t("statusBar.changesHint")}
        >
          {t("statusBar.changesDetected", { count: totalChanges })}
        </button>
      ) : (
        <span className="statusbar-item statusbar-tasks">
          {t("statusBar.tasks")}: {watchActive ? t("statusBar.watching", { count: watchPathCount }) : t("statusBar.idle")}
        </span>
      )}
    </footer>
  );
}
