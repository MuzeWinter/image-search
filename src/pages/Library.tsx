import { useState, useEffect, useCallback, useRef } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useI18n } from "../i18n/context";
import { useToast } from "../contexts/ToastContext";
import { useServiceQuery } from "../stores/hooks";
import { invalidPathsAtom, scanPhaseAtom, type ScanPhase } from "../stores/atoms";
import * as libraryService from "../services/libraryService";
import * as scanService from "../services/scanService";
import { syncScanConfig } from "../services/settingsService";
import type { Library, ScanProgress, ScanResult } from "../services/types";
import { Skeleton } from "../components/shared/Skeleton";
import { InlineError } from "../components/shared/InlineError";
import { EmptyState, LibraryEmptyIcon } from "../components/shared/EmptyState";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

export default function LibraryPage() {
  const { t } = useI18n();
  const { addToast } = useToast();
  const invalidPaths = useAtomValue(invalidPathsAtom);
  const setScanPhaseAtom = useSetAtom(scanPhaseAtom);
  const [libPath, setLibPath] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [scanningLibId, setScanningLibId] = useState<number | null>(null);
  const [scanPhase, setScanPhase] = useState<ScanPhase>("idle");
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const dragOverRef = useRef(false);
  const unlistenRef = useRef<UnlistenFn | null>(null);
  const pendingDeletesRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<number>>(new Set());

  const {
    data: libraries,
    loading: libsLoading,
    error: libsError,
    refetch: refetchLibs,
  } = useServiceQuery<Library[]>("libraryService", "libraries.list");

  useEffect(() => {
    return () => {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const pendingDeletes = pendingDeletesRef.current;
    return () => {
      pendingDeletes.forEach((timerId) => clearTimeout(timerId));
      pendingDeletes.clear();
    };
  }, []);

  useEffect(() => {
    let dropUnlisten: UnlistenFn | undefined;
    getCurrentWindow().onDragDropEvent(async (event) => {
      const payload = event.payload;
      if (payload.type === "drop") {
        setDragOver(false);
        dragOverRef.current = false;
        if (!listRef.current) return;
        const rect = listRef.current.getBoundingClientRect();
        const sx = payload.position.x / window.devicePixelRatio;
        const sy = payload.position.y / window.devicePixelRatio;
        const overList = sx >= rect.left && sx <= rect.right && sy >= rect.top && sy <= rect.bottom;
        if (!overList || payload.paths.length === 0) return;

        for (const filePath of payload.paths) {
          try {
            await libraryService.add(filePath);
            addToast("success", t("libraries.added"));
            refetchLibs();
          } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            if (!errMsg.toLowerCase().includes("already exists") && !errMsg.includes("已存在")) {
              addToast("error", errMsg);
            } else {
              addToast("warning", t("libraries.alreadyExists", { path: filePath }));
            }
          }
        }
      }
    }).then((fn) => {
      dropUnlisten = fn;
    });
    return () => {
      if (dropUnlisten) dropUnlisten();
    };
  }, [t, addToast, refetchLibs]);

  // Sync scanPhase to global atom so AppShell can update window title
  useEffect(() => {
    setScanPhaseAtom(scanPhase);
    return () => {
      setScanPhaseAtom("idle");
    };
  }, [scanPhase, setScanPhaseAtom]);

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
      addToast("success", t("libraries.added"));
      refetchLibs();
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : String(e));
    }
  };

  const handleOpenFolderDialog = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        title: t("libraries.selectFolder"),
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
      await syncScanConfig();
      await startListening();
      const result = await scanService.startScan(lib.id, lib.path);
      setScanResult(result);
      setScanPhase("complete");
      addToast("success", t("libraries.scanComplete"));
      refetchLibs();
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (errMsg.includes("cancelled") || errMsg.includes("killed")) {
        setScanPhase("idle");
      } else {
        setScanPhase("error");
        addToast("error", errMsg);
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
    if (pendingDeleteIds.has(lib.id)) return;

    setPendingDeleteIds((prev) => new Set(prev).add(lib.id));
    addToast("info", t("libraries.deleteScheduled"));

    const timerId = setTimeout(async () => {
      pendingDeletesRef.current.delete(lib.id);
      try {
        await libraryService.remove(lib.id);
        setPendingDeleteIds((prev) => {
          const next = new Set(prev);
          next.delete(lib.id);
          return next;
        });
        refetchLibs();
        addToast("success", t("libraries.deleted"));
      } catch (e) {
        setPendingDeleteIds((prev) => {
          const next = new Set(prev);
          next.delete(lib.id);
          return next;
        });
        addToast("error", e instanceof Error ? e.message : String(e));
      }
    }, 5000);

    pendingDeletesRef.current.set(lib.id, timerId);
  };

  const handleUndoDelete = (lib: Library) => {
    const timerId = pendingDeletesRef.current.get(lib.id);
    if (timerId) {
      clearTimeout(timerId);
      pendingDeletesRef.current.delete(lib.id);
    }
    setPendingDeleteIds((prev) => {
      const next = new Set(prev);
      next.delete(lib.id);
      return next;
    });
    addToast("success", t("libraries.deleteUndone"));
  };

  const handleOpenFolder = async (lib: Library) => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(lib.path);
    } catch {
      setSaveMsg(t("libraries.cannotOpen"));
    }
  };

  const statusDot = (status: string) => {
    switch (status) {
      case "scanning": return <span className="lib-status-dot scanning" title={t("libraries.scanning")} />;
      case "ready": return <span className="lib-status-dot ready" title={t("libraries.ready")} />;
      case "error": return <span className="lib-status-dot error" title={t("libraries.error")} />;
      default: return <span className="lib-status-dot idle" title={t("libraries.idle")} />;
    }
  };

  const phaseLabel = (phase: string) => {
    switch (phase) {
      case "collecting": return t("libraries.phaseCollecting");
      case "hashing": return t("libraries.phaseHashing");
      case "comparing": return t("libraries.phaseComparing");
      case "saving": return t("libraries.phaseSaving");
      case "ug_preview": return t("libraries.phaseUgPreview");
      case "matching": return t("libraries.phaseMatching");
      case "indexing": return t("libraries.phaseIndexing");
      default: return "";
    }
  };

  const truncatePath = (path: string, maxLen = 60) => {
    if (path.length <= maxLen) return path;
    const parts = path.replace(/\\/g, "/").split("/");
    if (parts.length <= 2) return "..." + path.slice(-maxLen);
    return parts[0] + "/.../" + parts[parts.length - 1];
  };

  const formatTime = (sec: number) => {
    if (sec < 60) return `${sec.toFixed(0)}s`;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}m ${s}s`;
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
            placeholder={t("libraries.pathHint")}
            value={libPath}
            onChange={(e) => setLibPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddLibrary();
            }}
          />
          <button className="settings-btn-primary" onClick={handleOpenFolderDialog}>
            {t("libraries.browse")}
          </button>
          <button className="settings-btn-primary" onClick={handleAddLibrary}>
            {t("libraries.add")}
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
              {scanPhase === "scanning" ? t("libraries.scanning") : t("libraries.scanComplete")}
            </span>
            {scanPhase === "scanning" && (
              <button className="settings-btn-danger" onClick={handleCancelScan}>
                {t("libraries.cancelScan")}
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
              <div className="scan-progress-time">
                <span className="scan-progress-elapsed">
                  {t("libraries.elapsedTime")}: {formatTime(scanProgress.elapsed_sec)}
                </span>
                {scanProgress.eta_sec > 0 && (
                  <span className="scan-progress-eta">
                    {t("libraries.estimatedTime")}: {formatTime(scanProgress.eta_sec)}
                  </span>
                )}
              </div>
              {scanProgress.current_file && (
                <div className="scan-progress-file text-mono" title={scanProgress.current_file}>
                  {truncatePath(scanProgress.current_file)}
                </div>
              )}
            </>
          )}

          {scanResult && (
            <div className="scan-result-stats">
              <div className="scan-result-stat">
                <span className="scan-result-num">{scanResult.total_files}</span>
                <span className="scan-result-label">{t("libraries.totalFiles")}</span>
              </div>
              <div className="scan-result-stat added">
                <span className="scan-result-num">+{scanResult.added}</span>
                <span className="scan-result-label">{t("libraries.addedFiles")}</span>
              </div>
              <div className="scan-result-stat modified">
                <span className="scan-result-num">{scanResult.modified}</span>
                <span className="scan-result-label">{t("libraries.modifiedFiles")}</span>
              </div>
              <div className="scan-result-stat removed">
                <span className="scan-result-num">{scanResult.removed}</span>
                <span className="scan-result-label">{t("libraries.removedFiles")}</span>
              </div>
              <div className="scan-result-stat moved">
                <span className="scan-result-num">{scanResult.moved}</span>
                <span className="scan-result-label">{t("libraries.movedFiles")}</span>
              </div>
              <div className="scan-result-stat">
                <span className="scan-result-num">{scanResult.duration_sec}s</span>
                <span className="scan-result-label">{t("libraries.duration")}</span>
              </div>
              <div className="scan-result-stat">
                <span className="scan-result-num">{scanResult.image_count}</span>
                <span className="scan-result-label">{t("libraries.images")}</span>
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
                  <span className="scan-result-label">{t("libraries.excelImages")}</span>
                </div>
              )}
              {scanResult.auto_matches !== undefined && scanResult.auto_matches > 0 && (
                <div className="scan-result-stat match">
                  <span className="scan-result-num">{scanResult.auto_matches}</span>
                  <span className="scan-result-label">{t("libraries.autoMatches")}</span>
                </div>
              )}
              {scanResult.auto_indexed !== undefined && scanResult.auto_indexed > 0 && (
                <div className="scan-result-stat indexed">
                  <span className="scan-result-num">{scanResult.auto_indexed}</span>
                  <span className="scan-result-label">{t("libraries.autoIndexed")}</span>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Library List */}
      <section
        className={`library-list-section${dragOver ? " drag-over" : ""}`}
        ref={listRef}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "link";
          if (!dragOverRef.current) {
            dragOverRef.current = true;
            setDragOver(true);
          }
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            dragOverRef.current = false;
            setDragOver(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragOverRef.current = false;
          setDragOver(false);
        }}
      >
        {dragOver && (
          <div className="library-drop-overlay">
            <span className="library-drop-icon">📁</span>
            <p className="library-drop-text">{t("libraries.dropHint")}</p>
          </div>
        )}
        {libsLoading ? (
          <Skeleton variant="card" height={160} />
        ) : libraries && libraries.length > 0 ? (
          <div className="library-table-wrap">
            <table className="library-table">
              <thead>
                <tr>
                  <th className="lib-col-status"></th>
                  <th className="lib-col-path">{t("libraries.path")}</th>
                  <th className="lib-col-count">{t("libraries.files")}</th>
                  <th className="lib-col-count">{t("libraries.images")}</th>
                  <th className="lib-col-count">{t("libraries.prt")}</th>
                  <th className="lib-col-time">{t("libraries.lastScan")}</th>
                  <th className="lib-col-actions">{t("libraries.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {libraries.map((lib) => {
                  const isActiveScan = scanningLibId === lib.id && scanPhase === "scanning";
                  const isUnavailable = invalidPaths.has(lib.id);
                  const isPendingDelete = pendingDeleteIds.has(lib.id);
                  return (
                    <tr
                      key={lib.id}
                      className={
                        isActiveScan ? "lib-row-scanning" : isUnavailable ? "lib-row-unavailable" : isPendingDelete ? "lib-row-pending-delete" : ""
                      }
                    >
                      <td className="lib-col-status">
                        {isUnavailable ? (
                          <span className="lib-status-dot unavailable" title={t("libraries.unavailable")} />
                        ) : isActiveScan ? (
                          <span className="lib-status-dot scanning" />
                        ) : (
                          statusDot(lib.status)
                        )}
                      </td>
                      <td className="lib-col-path" title={lib.path}>
                        <span className={isUnavailable ? "lib-label-unavailable" : "lib-label"}>
                          {lib.label || lib.path}
                        </span>
                        <span className="lib-path-sub text-muted text-xs">{lib.path}</span>
                      </td>
                      <td className="lib-col-count text-mono">{lib.file_count}</td>
                      <td className="lib-col-count text-mono">{lib.image_count}</td>
                      <td className="lib-col-count text-mono">{lib.prt_count}</td>
                      <td className="lib-col-time text-muted text-xs">
                        {lib.last_scan ?? "-"}
                      </td>
                      <td className="lib-col-actions">
                        <button
                          className="lib-action-btn"
                          onClick={() => handleOpenFolder(lib)}
                          title={t("libraries.openFolder")}
                          disabled={isActiveScan || isPendingDelete}
                        >
                          {t("libraries.open")}
                        </button>
                        <button
                          className="lib-action-btn lib-action-scan"
                          onClick={() => handleScanLibrary(lib)}
                          title={t("libraries.scan")}
                          disabled={scanPhase === "scanning" || isUnavailable || isPendingDelete}
                        >
                          {t("libraries.scan")}
                        </button>
                        {isPendingDelete ? (
                          <button
                            className="lib-action-btn lib-action-undo"
                            onClick={() => handleUndoDelete(lib)}
                            title={t("libraries.undo")}
                          >
                            {t("libraries.undo")}
                          </button>
                        ) : (
                          <button
                            className="lib-action-btn lib-action-delete"
                            onClick={() => handleRemoveLibrary(lib)}
                            title={t("libraries.delete")}
                            disabled={isActiveScan}
                          >
                            {t("common.delete")}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<LibraryEmptyIcon />}
            title={t("libraries.emptyTitle")}
            description={t("libraries.emptyDesc")}
          />
        )}
      </section>
    </div>
  );
}
