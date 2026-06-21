import { useState, useCallback, useEffect } from "react";
import { useI18n } from "../i18n/context";
import * as dbService from "../services/dbService";
import type { CadFile, ImageRecord } from "../services/types";

const PAGE_SIZE = 50;

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function openFile(filePath: string) {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(filePath);
  } catch { /* silent */ }
}

async function openFolder(filePath: string) {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    const sep = filePath.includes("\\") ? "\\" : "/";
    const folder = filePath.substring(0, filePath.lastIndexOf(sep));
    await open(folder || filePath);
  } catch { /* silent */ }
}

async function copyPath(filePath: string) {
  try {
    await navigator.clipboard.writeText(filePath);
  } catch { /* silent */ }
}

export default function CadFiles() {
  const { t } = useI18n();
  const [extFilter, setExtFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [cadFiles, setCadFiles] = useState<CadFile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [extensions, setExtensions] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [associatedImages, setAssociatedImages] = useState<Record<string, ImageRecord[]>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchExtensions = useCallback(async () => {
    try {
      const rows = await dbService.query<{ extension: string }>(
        "SELECT DISTINCT extension FROM cad_files WHERE extension IS NOT NULL AND extension != '' ORDER BY extension"
      );
      setExtensions(rows.map((r) => r.extension));
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchExtensions(); }, [fetchExtensions]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let where = "";
      const params: unknown[] = [];
      if (extFilter !== "all") {
        where = "WHERE extension = ?";
        params.push(extFilter);
      }
      const countQ = `SELECT COUNT(*) as n FROM cad_files ${where}`;
      const countResult = await dbService.query<{ n: number }>(countQ, params);
      setTotalCount(countResult[0]?.n ?? 0);

      const dataQ = `SELECT * FROM cad_files ${where} ORDER BY indexed_at DESC LIMIT ? OFFSET ?`;
      const data = await dbService.query<CadFile>(dataQ, [...params, PAGE_SIZE, page * PAGE_SIZE]);
      setCadFiles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [extFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleExpand = async (cadId: string) => {
    if (expandedId === cadId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(cadId);
    if (!associatedImages[cadId]) {
      try {
        const cad = cadFiles.find((c) => c.cad_id === cadId);
        const ref = cad?.img_ref;
        if (ref) {
          const imgs = await dbService.query<ImageRecord>(
            "SELECT * FROM images WHERE img_id = ? OR cad_ref = ?",
            [ref, cadId]
          );
          setAssociatedImages((prev) => ({ ...prev, [cadId]: imgs }));
        } else {
          const imgs = await dbService.query<ImageRecord>(
            "SELECT * FROM images WHERE cad_ref = ?",
            [cadId]
          );
          setAssociatedImages((prev) => ({ ...prev, [cadId]: imgs }));
        }
      } catch { /* silent */ }
    }
  };

  const handleCopyPath = (filePath: string, cadId: string) => {
    copyPath(filePath);
    setCopiedId(cadId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="cad-page">
      <h2 className="page-title">{t("cadFiles.title")}</h2>

      {/* Filters */}
      <div className="il-filters">
        <div className="il-filter-group">
          <label className="il-filter-label">{t("cadFiles.filterExt")}</label>
          <select
            className="il-filter-select"
            value={extFilter}
            onChange={(e) => { setExtFilter(e.target.value); setPage(0); }}
          >
            <option value="all">{t("cadFiles.allExtensions")}</option>
            {extensions.map((ext) => (
              <option key={ext} value={ext}>{ext}</option>
            ))}
          </select>
        </div>
        <div className="il-filter-group">
          <span className="il-filter-label">{t("cadFiles.totalFiles", { count: String(totalCount) })}</span>
        </div>
      </div>

      {error && (
        <div className="il-error">
          <p>{t("common.error")}: {error}</p>
          <button className="il-retry-btn" onClick={fetchData}>{t("common.retry")}</button>
        </div>
      )}

      {loading && <div className="il-loading">{t("cadFiles.loading")}</div>}

      {!loading && !error && cadFiles.length === 0 && (
        <div className="il-empty">
          <p className="il-empty-icon">{t("cadFiles.emptyIcon")}</p>
          <p className="il-empty-title">{t("cadFiles.emptyTitle")}</p>
          <p className="il-empty-desc">{t("cadFiles.emptyDesc")}</p>
        </div>
      )}

      {!loading && !error && cadFiles.length > 0 && (
        <>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("cadFiles.cadId")}</th>
                  <th>{t("cadFiles.filename")}</th>
                  <th>{t("cadFiles.path")}</th>
                  <th>{t("cadFiles.extension")}</th>
                  <th>{t("cadFiles.size")}</th>
                  <th>{t("common.delete")}</th>
                </tr>
              </thead>
              <tbody>
                {cadFiles.map((cad) => (
                  <>
                    <tr
                      key={cad.cad_id}
                      className={`data-row ${expandedId === cad.cad_id ? "expanded" : ""}`}
                      onClick={() => toggleExpand(cad.cad_id)}
                    >
                      <td className="cell-id">{cad.cad_id}</td>
                      <td className="cell-filename" title={cad.filename || ""}>
                        {cad.filename || "-"}
                      </td>
                      <td className="cell-path" title={cad.file_path}>
                        {cad.folder || cad.file_path}
                      </td>
                      <td><span className="badge">{cad.extension || "-"}</span></td>
                      <td>{formatFileSize(cad.size_bytes)}</td>
                      <td className="cell-actions">
                        <button
                          className="table-action-btn"
                          onClick={(e) => { e.stopPropagation(); openFile(cad.file_path); }}
                        >
                          {t("cadFiles.open")}
                        </button>
                        <button
                          className="table-action-btn"
                          onClick={(e) => { e.stopPropagation(); openFolder(cad.file_path); }}
                        >
                          {t("cadFiles.openFolder")}
                        </button>
                        <button
                          className="table-action-btn"
                          onClick={(e) => { e.stopPropagation(); handleCopyPath(cad.file_path, cad.cad_id); }}
                        >
                          {copiedId === cad.cad_id ? t("cadFiles.copied") : t("cadFiles.copyPath")}
                        </button>
                      </td>
                    </tr>
                    {expandedId === cad.cad_id && (
                      <tr className="expand-row" key={`${cad.cad_id}-exp`}>
                        <td colSpan={6}>
                          <div className="expand-content">
                            <h4>{t("cadFiles.associatedImages")}</h4>
                            {!associatedImages[cad.cad_id] ? (
                              <p className="expand-loading">{t("common.loading")}</p>
                            ) : associatedImages[cad.cad_id].length === 0 ? (
                              <p className="expand-empty">{t("cadFiles.noImages")}</p>
                            ) : (
                              <div className="expand-image-grid">
                                {associatedImages[cad.cad_id].map((img) => (
                                  <div key={img.img_id} className="expand-image-card">
                                    <div className="expand-thumb">
                                      <img
                                        src={`asset://localhost/${encodeURI(img.file_path.replace(/\\/g, "/"))}`}
                                        alt={img.filename ?? img.img_id}
                                        loading="lazy"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = "none";
                                        }}
                                      />
                                    </div>
                                    <p className="expand-image-name">{img.filename || img.img_id}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="il-pagination">
              <button className="il-page-btn" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                {t("imageLibrary.prevPage")}
              </button>
              <span className="il-page-info">{page + 1} / {totalPages} ({totalCount} {t("imageLibrary.total")})</span>
              <button className="il-page-btn" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                {t("imageLibrary.nextPage")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
