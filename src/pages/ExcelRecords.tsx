import { useState, useCallback, useEffect } from "react";
import { useI18n } from "../i18n/context";
import * as dbService from "../services/dbService";
import type { ExcelRecord } from "../services/types";

const PAGE_SIZE = 40;

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

interface FileGroup {
  file_path: string;
  filename: string | null;
  cnt: number;
  last_idx: string;
}

export default function ExcelRecords() {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const [fileGroups, setFileGroups] = useState<FileGroup[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPath, setExpandedPath] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<string, ExcelRecord[]>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchFileGroups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const countResult = await dbService.query<{ n: number }>(
        "SELECT COUNT(DISTINCT file_path) as n FROM excel_records"
      );
      setTotalCount(countResult[0]?.n ?? 0);

      const rows = await dbService.query<FileGroup>(
        "SELECT file_path, filename, COUNT(*) as cnt, MAX(indexed_at) as last_idx FROM excel_records GROUP BY file_path ORDER BY last_idx DESC LIMIT ? OFFSET ?",
        [PAGE_SIZE, page * PAGE_SIZE]
      );
      setFileGroups(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchFileGroups(); }, [fetchFileGroups]);

  const toggleExpand = async (filePath: string) => {
    if (expandedPath === filePath) {
      setExpandedPath(null);
      return;
    }
    setExpandedPath(filePath);
    if (!records[filePath]) {
      try {
        const rows = await dbService.query<ExcelRecord>(
          "SELECT * FROM excel_records WHERE file_path = ? ORDER BY sheet_name, row_number, column_name LIMIT 500",
          [filePath]
        );
        setRecords((prev) => ({ ...prev, [filePath]: rows }));
      } catch { /* silent */ }
    }
  };

  const handleCopy = (text: string, id: string) => {
    copyPath(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="excel-page">
      <h2 className="page-title">{t("excelRecords.title")}</h2>

      <div className="il-filters">
        <div className="il-filter-group">
          <span className="il-filter-label">{t("excelRecords.totalRecords", { count: String(totalCount) })}</span>
        </div>
      </div>

      {error && (
        <div className="il-error">
          <p>{t("common.error")}: {error}</p>
          <button className="il-retry-btn" onClick={fetchFileGroups}>{t("common.retry")}</button>
        </div>
      )}

      {loading && <div className="il-loading">{t("excelRecords.loading")}</div>}

      {!loading && !error && fileGroups.length === 0 && (
        <div className="il-empty">
          <p className="il-empty-icon">{t("excelRecords.emptyIcon")}</p>
          <p className="il-empty-title">{t("excelRecords.emptyTitle")}</p>
          <p className="il-empty-desc">{t("excelRecords.emptyDesc")}</p>
        </div>
      )}

      {!loading && !error && fileGroups.length > 0 && (
        <>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("excelRecords.filename")}</th>
                  <th>{t("excelRecords.path")}</th>
                  <th>{t("excelRecords.value")}</th>
                  <th>{t("common.delete")}</th>
                </tr>
              </thead>
              <tbody>
                {fileGroups.map((fg) => (
                  <>
                    <tr
                      key={fg.file_path}
                      className={`data-row ${expandedPath === fg.file_path ? "expanded" : ""}`}
                      onClick={() => toggleExpand(fg.file_path)}
                    >
                      <td className="cell-filename" title={fg.filename || ""}>
                        {fg.filename || fg.file_path}
                      </td>
                      <td className="cell-path" title={fg.file_path}>
                        {fg.file_path}
                      </td>
                      <td><span className="badge">{fg.cnt} rows</span></td>
                      <td className="cell-actions">
                        <button
                          className="table-action-btn"
                          onClick={(e) => { e.stopPropagation(); openFile(fg.file_path); }}
                        >
                          {t("excelRecords.openExcel")}
                        </button>
                        <button
                          className="table-action-btn"
                          onClick={(e) => { e.stopPropagation(); openFolder(fg.file_path); }}
                        >
                          {t("excelRecords.openFolder")}
                        </button>
                        <button
                          className="table-action-btn"
                          onClick={(e) => { e.stopPropagation(); handleCopy(fg.file_path, fg.file_path); }}
                        >
                          {copiedId === fg.file_path ? t("excelRecords.copied") : t("excelRecords.copyPath")}
                        </button>
                      </td>
                    </tr>
                    {expandedPath === fg.file_path && (
                      <tr className="expand-row" key={`${fg.file_path}-exp`}>
                        <td colSpan={4}>
                          <div className="expand-content">
                            {!records[fg.file_path] ? (
                              <p className="expand-loading">{t("common.loading")}</p>
                            ) : (
                              <table className="expand-table">
                                <thead>
                                  <tr>
                                    <th>{t("excelRecords.exId")}</th>
                                    <th>{t("excelRecords.sheet")}</th>
                                    <th>{t("excelRecords.row")}</th>
                                    <th>{t("excelRecords.column")}</th>
                                    <th>{t("excelRecords.value")}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {records[fg.file_path].map((rec) => (
                                    <tr key={rec.ex_id}>
                                      <td className="cell-id">{rec.ex_id}</td>
                                      <td>{rec.sheet_name}</td>
                                      <td>{rec.row_number}</td>
                                      <td>{rec.column_name || "-"}</td>
                                      <td className="cell-value" title={rec.cell_value || ""}>
                                        {(rec.cell_value || "").substring(0, 200)}
                                        {(rec.cell_value || "").length > 200 ? "..." : ""}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
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
