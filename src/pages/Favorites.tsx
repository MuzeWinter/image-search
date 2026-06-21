import { useState, useCallback, useEffect } from "react";
import { useI18n } from "../i18n/context";
import * as dbService from "../services/dbService";
import type { ImageRecord } from "../services/types";

type SortField = "indexed_at" | "filename";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 60;

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

async function copyPath(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch { /* silent */ }
}

function fileToUrl(filePath: string): string {
  return `asset://localhost/${encodeURI(filePath.replace(/\\/g, "/"))}`;
}

export default function Favorites() {
  const { t } = useI18n();
  const [sortField, setSortField] = useState<SortField>("indexed_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmUnfav, setConfirmUnfav] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const countResult = await dbService.query<{ n: number }>(
        "SELECT COUNT(*) as n FROM images WHERE favorite = 1"
      );
      setTotalCount(countResult[0]?.n ?? 0);

      const orderCol = sortField === "filename" ? "filename" : "indexed_at";
      const orderDir = sortDir === "asc" ? "ASC" : "DESC";
      const rows = await dbService.query<ImageRecord>(
        `SELECT * FROM images WHERE favorite = 1 ORDER BY ${orderCol} ${orderDir} LIMIT ? OFFSET ?`,
        [PAGE_SIZE, page * PAGE_SIZE]
      );
      setImages(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [sortField, sortDir, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUnfavorite = async (imgId: string) => {
    try {
      await dbService.execute("UPDATE images SET favorite = 0 WHERE img_id = ?", [imgId]);
      setActionMsg(t("favorites.unfavorited"));
      setConfirmUnfav(null);
      fetchData();
      setTimeout(() => setActionMsg(""), 3000);
    } catch (e) {
      setActionMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleCopy = (text: string, id: string) => {
    copyPath(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="fav-page">
      <h2 className="page-title">{t("favorites.title")}</h2>

      {/* Filters */}
      <div className="il-filters">
        <div className="il-filter-group">
          <label className="il-filter-label">{t("favorites.sort")}</label>
          <select
            className="il-filter-select"
            value={`${sortField}-${sortDir}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split("-") as [SortField, SortDir];
              setSortField(field);
              setSortDir(dir);
              setPage(0);
            }}
          >
            <option value="indexed_at-desc">{t("favorites.sortNewest")}</option>
            <option value="indexed_at-asc">{t("favorites.sortOldest")}</option>
            <option value="filename-asc">{t("favorites.sortName")}</option>
          </select>
        </div>
        <div className="il-filter-group">
          <span className="il-filter-label">{t("favorites.totalFavorites", { count: String(totalCount) })}</span>
        </div>
      </div>

      {actionMsg && <p className="il-batch-msg">{actionMsg}</p>}

      {error && (
        <div className="il-error">
          <p>{t("common.error")}: {error}</p>
          <button className="il-retry-btn" onClick={fetchData}>{t("common.retry")}</button>
        </div>
      )}

      {loading && <div className="il-loading">{t("favorites.loading")}</div>}

      {!loading && !error && images.length === 0 && (
        <div className="il-empty">
          <p className="il-empty-icon">{t("favorites.emptyIcon")}</p>
          <p className="il-empty-title">{t("favorites.emptyTitle")}</p>
          <p className="il-empty-desc">{t("favorites.emptyDesc")}</p>
        </div>
      )}

      {!loading && !error && images.length > 0 && (
        <>
          <div className="il-grid">
            {images.map((img) => (
              <div key={img.img_id} className="il-card">
                <div className="il-card-thumb">
                  <img
                    src={fileToUrl(img.file_path)}
                    alt={img.filename ?? img.img_id}
                    loading="lazy"
                    onError={(e) => {
                      const el = e.target as HTMLImageElement;
                      el.style.display = "none";
                      el.parentElement!.classList.add("no-thumb");
                    }}
                  />
                </div>
                <div className="il-card-info">
                  <p className="il-card-name" title={img.filename ?? img.img_id}>
                    {img.filename || img.img_id}
                  </p>
                  <p className="il-card-meta">
                    <span className={`il-source-badge ${img.source_type === "excel_embedded" ? "excel" : "file"}`}>
                      {img.source_type === "excel_embedded" ? "EX" : "IMG"}
                    </span>
                    {img.width && img.height && (
                      <span>{img.width}x{img.height}</span>
                    )}
                    {img.size_bytes !== null && (
                      <span>{formatFileSize(img.size_bytes)}</span>
                    )}
                  </p>
                  {img.tags && (
                    <div className="il-card-tags">
                      {img.tags.split(",").filter(Boolean).slice(0, 3).map((tag) => (
                        <span key={tag} className="il-card-tag">{tag.trim()}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="il-card-actions">
                  <button
                    className="il-card-action-btn"
                    onClick={(e) => { e.stopPropagation(); openFile(img.file_path); }}
                  >
                    {t("favorites.open")}
                  </button>
                  <button
                    className="il-card-action-btn"
                    onClick={(e) => { e.stopPropagation(); openFolder(img.file_path); }}
                  >
                    {t("favorites.openFolder")}
                  </button>
                  <button
                    className="il-card-action-btn"
                    onClick={(e) => { e.stopPropagation(); handleCopy(img.file_path, img.img_id); }}
                  >
                    {copiedId === img.img_id ? t("favorites.copied") : t("favorites.copyPath")}
                  </button>
                  <button
                    className="il-card-action-btn il-card-action-danger"
                    onClick={(e) => { e.stopPropagation(); setConfirmUnfav(img.img_id); }}
                  >
                    {t("favorites.unfavorite")}
                  </button>
                </div>

                {confirmUnfav === img.img_id && (
                  <div className="il-delete-confirm" onClick={(e) => e.stopPropagation()}>
                    <p>{t("favorites.unfavorite")}?</p>
                    <div className="il-delete-confirm-actions">
                      <button
                        className="il-card-action-btn il-card-action-danger"
                        onClick={() => handleUnfavorite(img.img_id)}
                      >
                        {t("common.confirm")}
                      </button>
                      <button
                        className="il-card-action-btn"
                        onClick={() => setConfirmUnfav(null)}
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
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
