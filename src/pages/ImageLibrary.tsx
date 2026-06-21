import { useState, useCallback, useEffect } from "react";
import { useI18n } from "../i18n/context";
import { useServiceQuery } from "../stores/hooks";
import * as dbService from "../services/dbService";
import type { ImageRecord } from "../services/types";

type SourceFilter = "all" | "file_image" | "excel_embedded";
type SortField = "indexed_at" | "filename" | "size_bytes";
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
  } catch {
    // silently fail
  }
}

async function openFolder(filePath: string) {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    // Open the containing folder
    const sep = filePath.includes("\\") ? "\\" : "/";
    const folder = filePath.substring(0, filePath.lastIndexOf(sep));
    await open(folder || filePath);
  } catch {
    // silently fail
  }
}

function fileToUrl(filePath: string): string {
  return `asset://localhost/${encodeURI(filePath.replace(/\\/g, "/"))}`;
}

export default function ImageLibrary() {
  const { t } = useI18n();
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [tagFilter, setTagFilter] = useState("");
  const [favFilter, setFavFilter] = useState(false);
  const [sortField, setSortField] = useState<SortField>("indexed_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchTagInput, setBatchTagInput] = useState("");
  const [batchMsg, setBatchMsg] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const buildQuery = useCallback((countOnly: boolean) => {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (sourceFilter !== "all") {
      conditions.push("source_type = ?");
      params.push(sourceFilter);
    }
    if (tagFilter.trim()) {
      conditions.push("tags LIKE ?");
      params.push(`%${tagFilter.trim()}%`);
    }
    if (favFilter) {
      conditions.push("favorite = 1");
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    if (countOnly) {
      return { sql: `SELECT COUNT(*) as n FROM images ${where}`, params };
    }

    const orderDir = sortDir === "asc" ? "ASC" : "DESC";
    let orderCol: string;
    switch (sortField) {
      case "filename": orderCol = "filename"; break;
      case "size_bytes": orderCol = "size_bytes"; break;
      default: orderCol = "indexed_at";
    }

    return {
      sql: `SELECT * FROM images ${where} ORDER BY ${orderCol} ${orderDir} LIMIT ? OFFSET ?`,
      params: [...params, PAGE_SIZE, page * PAGE_SIZE],
    };
  }, [sourceFilter, tagFilter, favFilter, sortField, sortDir, page]);

  const fetchImages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const countQ = buildQuery(true);
      const countResult = await dbService.query<{ n: number }>(countQ.sql, countQ.params);
      setTotalCount(countResult[0]?.n ?? 0);

      const dataQ = buildQuery(false);
      const data = await dbService.query<ImageRecord>(dataQ.sql, dataQ.params);
      setImages(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const toggleSelect = (imgId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(imgId)) next.delete(imgId); else next.add(imgId);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === images.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(images.map((img) => img.img_id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(t("imageLibrary.batchDeleteConfirm", { count: String(selected.size) }))) return;
    try {
      for (const imgId of selected) {
        await dbService.execute("DELETE FROM images WHERE img_id = ?", [imgId]);
        await dbService.execute("DELETE FROM vector_embeddings WHERE img_id = ?", [imgId]);
      }
      setBatchMsg(t("imageLibrary.batchDeleted", { count: String(selected.size) }));
      setSelected(new Set());
      fetchImages();
      setTimeout(() => setBatchMsg(""), 3000);
    } catch (e) {
      setBatchMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleBatchAddTag = async () => {
    const tag = batchTagInput.trim();
    if (!tag || selected.size === 0) return;
    try {
      for (const imgId of selected) {
        const row = await dbService.query<{ tags: string | null }>(
          "SELECT tags FROM images WHERE img_id = ?", [imgId]
        );
        const existing = row[0]?.tags || "";
        const tagSet = new Set(existing.split(",").map((t) => t.trim()).filter(Boolean));
        tagSet.add(tag);
        const newTags = Array.from(tagSet).join(", ");
        await dbService.execute("UPDATE images SET tags = ? WHERE img_id = ?", [newTags, imgId]);
      }
      setBatchMsg(t("imageLibrary.batchTagged", { tag, count: String(selected.size) }));
      setBatchTagInput("");
      setSelected(new Set());
      fetchImages();
      setTimeout(() => setBatchMsg(""), 3000);
    } catch (e) {
      setBatchMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleDeleteSingle = async (imgId: string) => {
    try {
      await dbService.execute("DELETE FROM images WHERE img_id = ?", [imgId]);
      await dbService.execute("DELETE FROM vector_embeddings WHERE img_id = ?", [imgId]);
      setConfirmDelete(null);
      fetchImages();
    } catch (e) {
      setBatchMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="image-library-page">
      <h2 className="page-title">{t("sidebar.nav.imageLibrary")}</h2>

      {/* Filters */}
      <div className="il-filters">
        <div className="il-filter-group">
          <label className="il-filter-label">{t("imageLibrary.sourceType")}</label>
          <select
            className="il-filter-select"
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value as SourceFilter); setPage(0); }}
          >
            <option value="all">{t("imageLibrary.allSources")}</option>
            <option value="file_image">{t("imageLibrary.fileImage")}</option>
            <option value="excel_embedded">{t("imageLibrary.excelEmbedded")}</option>
          </select>
        </div>

        <div className="il-filter-group">
          <label className="il-filter-label">{t("imageLibrary.tagFilter")}</label>
          <input
            className="il-filter-input"
            type="text"
            placeholder={t("imageLibrary.tagFilterHint")}
            value={tagFilter}
            onChange={(e) => { setTagFilter(e.target.value); setPage(0); }}
          />
        </div>

        <div className="il-filter-group">
          <label className="il-filter-label">{t("imageLibrary.sort")}</label>
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
            <option value="indexed_at-desc">{t("imageLibrary.sortNewest")}</option>
            <option value="indexed_at-asc">{t("imageLibrary.sortOldest")}</option>
            <option value="filename-asc">{t("imageLibrary.sortName")}</option>
            <option value="size_bytes-desc">{t("imageLibrary.sortSize")}</option>
          </select>
        </div>

        <div className="il-filter-group il-filter-check">
          <label className="il-filter-check-label">
            <input
              type="checkbox"
              checked={favFilter}
              onChange={(e) => { setFavFilter(e.target.checked); setPage(0); }}
            />
            {t("imageLibrary.favoritesOnly")}
          </label>
        </div>
      </div>

      {/* Batch actions */}
      {selected.size > 0 && (
        <div className="il-batch-bar">
          <span className="il-batch-count">
            {t("imageLibrary.selectedCount", { count: String(selected.size) })}
          </span>
          <button className="il-batch-btn" onClick={selectAll}>
            {t("imageLibrary.selectAll")}
          </button>
          <div className="il-batch-tag-group">
            <input
              className="il-filter-input il-batch-tag-input"
              type="text"
              placeholder={t("imageLibrary.addTagPlaceholder")}
              value={batchTagInput}
              onChange={(e) => setBatchTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleBatchAddTag(); }}
            />
            <button className="il-batch-btn il-batch-btn-primary" onClick={handleBatchAddTag}>
              {t("imageLibrary.addTag")}
            </button>
          </div>
          <button className="il-batch-btn il-batch-btn-danger" onClick={handleBatchDelete}>
            {t("imageLibrary.batchDelete")}
          </button>
        </div>
      )}

      {batchMsg && <p className="il-batch-msg">{batchMsg}</p>}

      {/* Error */}
      {error && (
        <div className="il-error">
          <p>{t("common.error")}: {error}</p>
          <button className="il-retry-btn" onClick={fetchImages}>{t("common.retry")}</button>
        </div>
      )}

      {/* Loading */}
      {loading && !error && (
        <div className="il-loading">{t("common.loading")}</div>
      )}

      {/* Grid */}
      {!loading && !error && images.length > 0 && (
        <>
          <div className="il-grid">
            {images.map((img) => (
              <div
                key={img.img_id}
                className={`il-card ${selected.has(img.img_id) ? "selected" : ""}`}
                onClick={() => toggleSelect(img.img_id)}
              >
                <div className="il-card-check">
                  <input
                    type="checkbox"
                    checked={selected.has(img.img_id)}
                    onChange={() => toggleSelect(img.img_id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
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
                    {t("imageLibrary.open")}
                  </button>
                  <button
                    className="il-card-action-btn"
                    onClick={(e) => { e.stopPropagation(); openFolder(img.file_path); }}
                  >
                    {t("imageLibrary.openFolder")}
                  </button>
                  <button
                    className="il-card-action-btn il-card-action-danger"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(img.img_id); }}
                  >
                    {t("common.delete")}
                  </button>
                </div>

                {/* Confirm delete popover */}
                {confirmDelete === img.img_id && (
                  <div className="il-delete-confirm" onClick={(e) => e.stopPropagation()}>
                    <p>{t("imageLibrary.deleteConfirm")}</p>
                    <div className="il-delete-confirm-actions">
                      <button
                        className="il-card-action-btn il-card-action-danger"
                        onClick={() => handleDeleteSingle(img.img_id)}
                      >
                        {t("common.confirm")}
                      </button>
                      <button
                        className="il-card-action-btn"
                        onClick={() => setConfirmDelete(null)}
                      >
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="il-pagination">
              <button
                className="il-page-btn"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                {t("imageLibrary.prevPage")}
              </button>
              <span className="il-page-info">
                {page + 1} / {totalPages} ({totalCount} {t("imageLibrary.total")})
              </span>
              <button
                className="il-page-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("imageLibrary.nextPage")}
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty */}
      {!loading && !error && images.length === 0 && (
        <div className="il-empty">
          <p className="il-empty-icon">🖼️</p>
          <p className="il-empty-title">{t("imageLibrary.emptyTitle")}</p>
          <p className="il-empty-desc">{t("imageLibrary.emptyDesc")}</p>
        </div>
      )}
    </div>
  );
}
