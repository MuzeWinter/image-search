import { useState, useEffect, useCallback, useRef } from "react";
import { useI18n } from "../i18n/context";
import { useServiceQuery } from "../stores/hooks";
import * as libraryService from "../services/libraryService";
import * as scanService from "../services/scanService";
import type { Library, ScanProgress, ScanResult } from "../services/types";
import { Skeleton } from "../components/shared/Skeleton";
import { InlineError } from "../components/shared/InlineError";
import type { UnlistenFn } from "@tauri-apps/api/event";

type ScanPhase = "idle" | "scanning" | "paused" | "complete" | "error";

export default function LibraryPage() {
  const { t } = useI18n();
  const [libPath, setLibPath] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [scanningLibId, setScanningLibId] = useState<number | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  const {
    data: libraries,
    loading: libsLoading,
    error: libsError,
    refetch: refetchLibs,
  } = useServiceQuery<Library[]>("libraryService", "library.list");

  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    if (unlistenRef.current) {
      unlistenRef.current();
    }
    unlistenRef.current = await scanService.onScanProgress((progress) => {
      setScanProgress(progress);
    });
  }, []);

  const stopListening = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
  }, []);

  const handleAddLibrary = async () => {
    const path = libPath.trim();
    if (!path) return;
    try {
      await libraryService.add(path);
      setLibPath("");
      setSaveMsg(t("library.added"));
      refetchLibs();
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleOpenFolderDialog = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        title: t("library.selectFolder"),
      });
      if (selected && typeof selected === "string") {
        setLibPath(selected);
      }
    } catch {
      // Dialog not available, user can type path manually
    }
  };

  const handleScanLibrary = async (lib: Library) => {
    if (scanPhase === "scanning") return;

    setScanningLibId(lib.id);
    setScanPhase("scanning");
    setScanProgress(null);
    setScanResult(null);
    setSaveMsg("");

    try {
      await startListening();
      const result = await scanService.startScan(lib.id, lib.path);
      setScanResult(result);
      setScanPhase("complete");
      refetchLibs();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (errMsg.includes("cancelled") || errMsg.includes("killed")) {
        setScanPhase("idle");
      } else {
        setScanPhase("error");
        setSaveMsg(errMsg);
      }
    } finally {
      stopListening();
    }
  };

  const handleCancelScan = async () => {
    try {
      await scanService.cancelScan();
      setScanPhase("idle");
      setScanningLibId(null);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRemoveLibrary = async (lib: Library) => {
    if (!window.confirm(t("library.deleteConfirm", { path: lib.label || lib.path }))) return;
    try {
      await libraryService.remove(lib.id);
      refetchLibs();
      setSaveMsg(t("library.deleted"));
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleOpenFolder = async (lib: Library) => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(lib.path);
    } catch {
      setSaveMsg(t("library.cannotOpen"));
    }
  };

  const statusDot = (status: string) => {
    switch (status) {
      case "scanning": return <span className="lib-status-dot scanning" title={t("library.scanning")} />;
      case "ready": return <span className="lib-status-dot ready" title={t("library.ready")} />;
      case "error": return <span className="lib-status-dot error" title={t("library.error")} />;
      default: return <span className="lib-status-dot idle" title={t("library.idle")} />;
    }
  };

  const phaseLabel = (phase: string) => {
    switch (phase) {
      case "collecting": return t("library.phaseCollecting");
      case "hashing": return t("library.phaseHashing");
      case "comparing": return t("library.phaseComparing");
      case "saving": return t("library.phaseSaving");
      default: return "";
    }
  };

  if (libsError) {
    return (
      <div className="page-placeholder">
        <h2>{t("sidebar.nav.library")}</h2>
        <InlineError message={libsError} onRetry={refetchLibs} />
      </div>
    );
  }

  return (
    <div className="library-page">
      <h2 className="page-title">{t("sidebar.nav.library")}</h2>

      {/* Add Library Bar */}
      <section className="library-add-bar">
        <div className="settings-input-group">
          <input
            type="text"
            className="settings-input"
            placeholder={t("library.pathHint")}
            value={libPath}
            onChange={(e) => setLibPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddLibrary();
            }}
          />
          <button className="settings-btn-primary" onClick={handleOpenFolderDialog}>
            {t("library.browse")}
          </button>
          <button className="settings-btn-primary" onClick={handleAddLibrary}>
            {t("library.add")}
          </button>
        </div>
        {saveMsg && (
          <p className={`settings-msg ${scanPhase === "error" ? "settings-error" : ""}`}>
            {saveMsg}
          </p>
        )}
      </section>

      {/* Scan Progress */}
      {(scanPhase === "scanning" || scanPhase === "complete" || scanPhase === "error") && (
        <section className="scan-progress-panel">
          <div className="scan-progress-header">
            <span className="scan-progress-title">
              {scanPhase === "scanning" ? t("library.scanning") : t("library.scanComplete")}
            </span>
            {scanPhase === "scanning" && (
              <button className="settings-btn-danger" onClick={handleCancelScan}>
                {t("library.cancelScan")}
              </button>
            )}
          </div>

          {scanProgress && (
            <>
              <div className="scan-progress-bar-track">
                <div
                  className="scan-progress-bar-fill"
                  style={{ width: `${scanProgress.percent}%` }}
                />
              </div>
              <div className="scan-progress-info">
                <span className="scan-progress-phase">{phaseLabel(scanProgress.phase)}</span>
                <span className="scan-progress-count">
                  {scanProgress.current} / {scanProgress.total} ({scanProgress.percent}%)
                </span>
              </div>
              {scanProgress.current_file && (
                <div className="scan-progress-file text-mono truncate">
                  {scanProgress.current_file}
                </div>
              )}
            </>
          )}

          {scanResult && (
            <div className="scan-result-stats">
              <div className="scan-result-stat">
                <span className="scan-result-num">{scanResult.total_files}</span>
                <span className="scan-result-label">{t("library.totalFiles")}</span>
              </div>
              <div className="scan-result-stat added">
                <span className="scan-result-num">+{scanResult.added}</span>
                <span className="scan-result-label">{t("library.addedFiles")}</span>
              </div>
              <div className="scan-result-stat modified">
                <span className="scan-result-num">{scanResult.modified}</span>
                <span className="scan-result-label">{t("library.modifiedFiles")}</span>
              </div>
              <div className="scan-result-stat removed">
                <span className="scan-result-num">{scanResult.removed}</span>
                <span className="scan-result-label">{t("library.removedFiles")}</span>
              </div>
              <div className="scan-result-stat moved">
                <span className="scan-result-num">{scanResult.moved}</span>
                <span className="scan-result-label">{t("library.movedFiles")}</span>
              </div>
              <div className="scan-result-stat">
                <span className="scan-result-num">{scanResult.duration_sec}s</span>
                <span className="scan-result-label">{t("library.duration")}</span>
              </div>
              <div className="scan-result-stat">
                <span className="scan-result-num">{scanResult.image_count}</span>
                <span className="scan-result-label">{t("library.images")}</span>
              </div>
              <div className="scan-result-stat">
                <span className="scan-result-num">{scanResult.excel_count}</span>
                <span className="scan-result-label">Excel</span>
              </div>
              <div className="scan-result-stat">
                <span className="scan-result-num">{scanResult.cad_count}</span>
                <span className="scan-result-label">CAD</span>
              </div>
              <div className="scan-result-stat">
                <span className="scan-result-num">{scanResult.pdf_count}</span>
                <span className="scan-result-label">PDF</span>
              </div>
              {scanResult.excel_image_count !== undefined && scanResult.excel_image_count > 0 && (
                <div className="scan-result-stat">
                  <span className="scan-result-num">{scanResult.excel_image_count}</span>
                  <span className="scan-result-label">{t("library.excelImages")}</span>
                </div>
              )}
              {scanResult.auto_matches !== undefined && scanResult.auto_matches > 0 && (
                <div className="scan-result-stat match">
                  <span className="scan-result-num">{scanResult.auto_matches}</span>
                  <span className="scan-result-label">{t("library.autoMatches")}</span>
                </div>
              )}
              {scanResult.auto_indexed !== undefined && scanResult.auto_indexed > 0 && (
                <div className="scan-result-stat indexed">
                  <span className="scan-result-num">{scanResult.auto_indexed}</span>
                  <span className="scan-result-label">{t("library.autoIndexed")}</span>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Library List */}
      <section className="library-list-section">
        {libsLoading ? (
          <Skeleton variant="card" height={160} />
        ) : libraries && libraries.length > 0 ? (
          <div className="library-table-wrap">
            <table className="library-table">
              <thead>
                <tr>
                  <th className="lib-col-status"></th>
                  <th className="lib-col-path">{t("library.path")}</th>
                  <th className="lib-col-count">{t("library.files")}</th>
                  <th className="lib-col-count">{t("library.images")}</th>
                  <th className="lib-col-time">{t("library.lastScan")}</th>
                  <th className="lib-col-actions">{t("library.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {libraries.map((lib) => {
                  const isActiveScan = scanningLibId === lib.id && scanPhase === "scanning";
                  return (
                    <tr key={lib.id} className={isActiveScan ? "lib-row-scanning" : ""}>
                      <td className="lib-col-status">
                        {isActiveScan ? (
                          <span className="lib-status-dot scanning" />
                        ) : (
                          statusDot(lib.status)
                        )}
                      </td>
                      <td className="lib-col-path" title={lib.path}>
                        <span className="lib-label">{lib.label || lib.path}</span>
                        <span className="lib-path-sub text-muted text-xs">{lib.path}</span>
                      </td>
                      <td className="lib-col-count text-mono">{lib.file_count}</td>
                      <td className="lib-col-count text-mono">{lib.image_count}</td>
                      <td className="lib-col-time text-muted text-xs">
                        {lib.last_scan ?? "-"}
                      </td>
                      <td className="lib-col-actions">
                        <button
                          className="lib-action-btn"
                          onClick={() => handleOpenFolder(lib)}
                          title={t("library.openFolder")}
                          disabled={isActiveScan}
                        >
                          {t("library.open")}
                        </button>
                        <button
                          className="lib-action-btn lib-action-scan"
                          onClick={() => handleScanLibrary(lib)}
                          title={t("library.scan")}
                          disabled={scanPhase === "scanning"}
                        >
                          {t("library.scan")}
                        </button>
                        <button
                          className="lib-action-btn lib-action-delete"
                          onClick={() => handleRemoveLibrary(lib)}
                          title={t("library.delete")}
                          disabled={isActiveScan}
                        >
                          {t("common.delete")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">{t("library.emptyIcon")}</div>
            <div className="empty-state-title">{t("library.emptyTitle")}</div>
            <div className="empty-state-description">{t("library.emptyDesc")}</div>
          </div>
        )}
      </section>
    </div>
  );
}
