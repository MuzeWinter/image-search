import { useState, useCallback, useEffect } from "react";
import { useI18n } from "../i18n/context";
import * as dbService from "../services/dbService";
import type { PdfFile, ImageRecord } from "../services/types";

const PAGE_SIZE = 40;

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

export default function PdfFiles() {
  const { t } = useI18n();
  const [page, setPage] = useState(0);
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [associatedImages, setAssociatedImages] = useState<Record<string, ImageRecord[]>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const countResult = await dbService.query<{ n: number }>(
        "SELECT COUNT(*) as n FROM pdf_files"
      );
      setTotalCount(countResult[0]?.n ?? 0);

      const rows = await dbService.query<PdfFile>(
        "SELECT * FROM pdf_files ORDER BY indexed_at DESC LIMIT ? OFFSET ?",
        [PAGE_SIZE, page * PAGE_SIZE]
      );
      setPdfFiles(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleExpand = async (docId: string) => {
    if (expandedId === docId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(docId);
    if (!associatedImages[docId]) {
      try {
        const pdf = pdfFiles.find((p) => p.doc_id === docId);
        const ref = pdf?.img_ref;
        if (ref) {
          const imgs = await dbService.query<ImageRecord>(
            "SELECT * FROM images WHERE img_id = ? OR pdf_ref = ?",
            [ref, docId]
          );
          setAssociatedImages((prev) => ({ ...prev, [docId]: imgs }));
        } else {
          const imgs = await dbService.query<ImageRecord>(
            "SELECT * FROM images WHERE pdf_ref = ?",
            [docId]
          );
          setAssociatedImages((prev) => ({ ...prev, [docId]: imgs }));
        }
      } catch { /* silent */ }
    }
  };

  const handleCopy = (filePath: string, id: string) => {
    copyPath(filePath);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="pdf-page">
      <h2 className="page-title">{t("pdfFiles.title")}</h2>

      <div className="il-filters">
        <div className="il-filter-group">
          <span className="il-filter-label">{t("pdfFiles.totalFiles", { count: String(totalCount) })}</span>
        </div>
      </div>

      {error && (
        <div className="il-error">
          <p>{t("common.error")}: {error}</p>
          <button className="il-retry-btn" onClick={fetchData}>{t("common.retry")}</button>
        </div>
      )}

      {loading && <div className="il-loading">{t("pdfFiles.loading")}</div>}

      {!loading && !error && pdfFiles.length === 0 && (
        <div className="il-empty">
          <p className="il-empty-icon">{t("pdfFiles.emptyIcon")}</p>
          <p className="il-empty-title">{t("pdfFiles.emptyTitle")}</p>
          <p className="il-empty-desc">{t("pdfFiles.emptyDesc")}</p>
        </div>
      )}

      {!loading && !error && pdfFiles.length > 0 && (
        <>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("pdfFiles.docId")}</th>
                  <th>{t("pdfFiles.filename")}</th>
                  <th>{t("pdfFiles.path")}</th>
                  <th>{t("pdfFiles.pages")}</th>
                  <th>{t("pdfFiles.size")}</th>
                  <th>{t("common.delete")}</th>
                </tr>
              </thead>
              <tbody>
                {pdfFiles.map((pdf) => (
                  <>
                    <tr
                      key={pdf.doc_id}
                      className={`data-row ${expandedId === pdf.doc_id ? "expanded" : ""}`}
                      onClick={() => toggleExpand(pdf.doc_id)}
                    >
                      <td className="cell-id">{pdf.doc_id}</td>
                      <td className="cell-filename" title={pdf.filename || ""}>
                        {pdf.filename || "-"}
                      </td>
                      <td className="cell-path" title={pdf.file_path}>
                        {pdf.folder || pdf.file_path}
                      </td>
                      <td>{pdf.page_count ?? "-"}</td>
                      <td>{formatFileSize(pdf.size_bytes)}</td>
                      <td className="cell-actions">
                        <button
                          className="table-action-btn"
                          onClick={(e) => { e.stopPropagation(); openFile(pdf.file_path); }}
                        >
                          {t("pdfFiles.open")}
                        </button>
                        <button
                          className="table-action-btn"
                          onClick={(e) => { e.stopPropagation(); openFolder(pdf.file_path); }}
                        >
                          {t("pdfFiles.openFolder")}
                        </button>
                        <button
                          className="table-action-btn"
                          onClick={(e) => { e.stopPropagation(); handleCopy(pdf.file_path, pdf.doc_id); }}
                        >
                          {copiedId === pdf.doc_id ? t("pdfFiles.copied") : t("pdfFiles.copyPath")}
                        </button>
                      </td>
                    </tr>
                    {expandedId === pdf.doc_id && (
                      <tr className="expand-row" key={`${pdf.doc_id}-exp`}>
                        <td colSpan={6}>
                          <div className="expand-content">
                            <h4>{t("pdfFiles.preview")}</h4>
                            {!associatedImages[pdf.doc_id] ? (
                              <p className="expand-loading">{t("common.loading")}</p>
                            ) : associatedImages[pdf.doc_id].length === 0 ? (
                              <p className="expand-empty">{t("pdfFiles.noPreview")}</p>
                            ) : (
                              <div className="expand-image-grid">
                                {associatedImages[pdf.doc_id].map((img) => (
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
