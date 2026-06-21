import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { convertFileSrc } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { List, Grid } from "react-window";
import { useI18n } from "../i18n/context";
import { useToast } from "../contexts/ToastContext";
import * as searchService from "../services/searchService";
import * as exportService from "../services/exportService";
import type { ExportProgress } from "../services/exportService";
import { callTauri } from "../services/ipc";
import type { SearchScope, SearchResultItem, SearchResults } from "../services/searchService";
import type { Library } from "../services/types";
import * as libraryService from "../services/libraryService";
import { openFile, openFolder } from "../services/systemService";
import ContextMenu from "../components/shared/ContextMenu";
import type { ContextMenuItem } from "../components/shared/ContextMenu";
import LazyThumbnail from "../components/shared/LazyThumbnail";
import { Tooltip } from "../components/shared/Tooltip";
import { EmptyState, SearchEmptyIcon } from "../components/shared/EmptyState";
import ImageCompareModal from "../components/shared/ImageCompareModal";
import SearchDetailPanel from "../components/shared/SearchDetailPanel";
import { escapeEpochAtom, splashStateAtom, startupSearchPathAtom } from "../stores/atoms";
import { useServiceQuery } from "../stores/hooks";
import type { SystemStats } from "../services/types";
import {
  getHistory,
  addHistory,
  deleteHistoryByIndex,
  clearHistory,
  createThumbnail,
} from "../services/searchHistoryStore";
import type { SearchHistoryItem } from "../services/searchHistoryStore";

type SearchState = "idle" | "model-loading" | "searching" | "done" | "error";
type SortKey = "similarity" | "filename" | "ug_ref";

interface QueryImage {
  base64: string;
  url: string;
  name: string;
}

interface VirtualRowData {
  items: SearchResultItem[];
  selectedIds: Set<string>;
  brokenImgs: Set<string>;
  bookmarkedIds: Set<string>;
  thumbPx: number;
  _gridCols: number;
  t: (key: string, params?: Record<string, string>) => string;
  toggleSelect: (imgId: string) => void;
  toggleBookmark: (imgId: string) => void;
  showContextMenu: (e: React.MouseEvent, item: SearchResultItem) => void;
  onThumbEnter: (e: React.MouseEvent<HTMLDivElement>, item: SearchResultItem) => void;
  onThumbLeave: () => void;
  onThumbClick: (e: React.MouseEvent<HTMLDivElement>, item: SearchResultItem) => void;
  onImgError: (imgId: string) => void;
  prtFileMap: Record<string, string[]>;
  setPrtDirFilter: (dir: string | null) => void;
}

type ResultListRowProps = VirtualRowData & {
  index: number;
  style: React.CSSProperties;
  ariaAttributes: { "aria-posinset": number; "aria-setsize": number; role: "listitem" };
};

function ResultListRow({ index, style, items, selectedIds, brokenImgs, bookmarkedIds, thumbPx, t, toggleSelect, toggleBookmark, showContextMenu, onThumbEnter, onThumbLeave, onThumbClick, onImgError, prtFileMap, setPrtDirFilter }: ResultListRowProps) {
  const item = items[index];
  const gap = 8;
  const innerH = (style.height as number) - gap;
  const isSelected = selectedIds.has(item.img_id);
  const isBroken = brokenImgs.has(item.img_id);
  const isBookmarked = bookmarkedIds.has(item.img_id);
  const simClass = similarityClass(item.similarity);
  const itemPrtFiles = getItemPrtFiles(item, prtFileMap);
  const hasPrt = itemPrtFiles.length > 0;
  const itemDir = item.image_path ? extractDir(item.image_path) : extractDir(item.origin_path);

  return (
    <div style={{ ...style, height: (style.height as number) }}>
      <div
        data-result-index={index}
        className={`search-result-item ${simClass} ${isSelected ? "selected" : ""}`}
        style={{ height: innerH }}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            toggleSelect(item.img_id);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          showContextMenu(e, item);
        }}
      >
        <div className="search-result-rank">#{index + 1}</div>
        <div
          className="search-result-thumb"
          style={{ width: thumbPx, height: thumbPx, minWidth: thumbPx }}
          onMouseEnter={(e) => onThumbEnter(e, item)}
          onMouseLeave={onThumbLeave}
          onClick={(e) => onThumbClick(e, item)}
          title={t("search.openImage")}
        >
          <LazyThumbnail
            imagePath={item.image_path}
            imgId={item.img_id}
            broken={isBroken}
            onError={() => onImgError(item.img_id)}
            noPreviewText={t("search.noPreview")}
          />
        </div>
        <div className="search-result-info">
          <div className="search-result-header">
            <span className="search-result-id" title={item.img_id}>{item.img_id}</span>
            <span className={`search-result-similarity ${simClass}`}>{formatSimilarity(item.similarity)}</span>
          </div>
          {item.source_query_indices && item.source_query_indices.length > 0 && (
            <div className="search-result-source-queries">
              {item.source_query_indices.map((qi) => (
                <span key={qi} className="search-source-query-badge" title={t("search.matchedSource", { index: String(qi + 1) })}>
                  #{qi + 1}
                </span>
              ))}
            </div>
          )}
          <div className="search-result-meta">
            <span className={`search-result-source-badge ${item.source_type}`}>
              {item.source_type === "excel-embedded" ? t("search.sourceExcelEmbedded") : item.source_type === "ug-preview" ? t("search.sourceUgPreview") : item.source_type}
            </span>
            <span className="search-result-path" title={item.origin_path}>{extractFilename(item.origin_path)}</span>
          </div>
          {(item.width != null || item.format || item.size_bytes != null) && (
            <div className="search-result-meta-info">
              {item.width != null && item.height != null && <span>{item.width}×{item.height}</span>}
              {item.width != null && item.height != null && item.format && <span className="meta-sep">·</span>}
              {item.format && <span>{item.format}</span>}
              {item.format && item.size_bytes != null && <span className="meta-sep">·</span>}
              {item.size_bytes != null && <span>{formatFileSize(item.size_bytes)}</span>}
            </div>
          )}
          {item.ocr_text && (
            <div className="search-result-detail">
              <span className="search-ocr-label">{t("search.ocrLabel")}:</span>
              <span className="search-ocr-text" title={item.ocr_text}>
                {item.ocr_text.length > 50 ? item.ocr_text.slice(0, 50) + "..." : item.ocr_text}
              </span>
            </div>
          )}
          {item.source_type === "excel-embedded" && item.sheet_name && (
            <div className="search-result-detail">
              <span className="detail-label">{t("search.sheet")}:</span>
              <span className="detail-value">{item.sheet_name}</span>
              {item.row_number != null && (
                <>
                  <span className="detail-label">{t("search.row")}:</span>
                  <span className="detail-value">R{item.row_number}</span>
                </>
              )}
            </div>
          )}
          {item.ug_ref && (
            <div className="search-result-detail">
              <span className="detail-label">UG:</span>
              <span className="detail-value">{item.ug_ref}</span>
            </div>
          )}
          {hasPrt && (
            <div className="search-result-detail">
              <span className="detail-label" style={{ color: "var(--accent)" }}>PRT:</span>
              <button
                className="search-result-prt-link"
                onClick={(e) => { e.stopPropagation(); setPrtDirFilter(itemDir); }}
                title={t("search.filterByPrtDir")}
              >
                {itemPrtFiles.length === 1
                  ? extractFilename(itemPrtFiles[0])
                  : t("search.prtFileCount", { count: String(itemPrtFiles.length) })}
              </button>
            </div>
          )}
        </div>
        <div className="search-result-actions">
          {item.source_type === "excel-embedded" && (
            <button className="search-action-btn search-action-primary" onClick={() => openFile(item.origin_path)} aria-label={t("search.openExcel")}>
              {t("search.openExcel")}
            </button>
          )}
          {item.source_type === "ug-preview" && (
            <button className="search-action-btn search-action-primary" onClick={() => openFolder(item.origin_path)} aria-label={t("search.openUgFolder")}>
              {t("search.openUgFolder")}
            </button>
          )}
          {hasPrt && (
            <button className="search-action-btn search-action-primary" onClick={() => openFile(itemPrtFiles[0])} aria-label={t("search.openPrt")}>
              {t("search.openPrt")}
            </button>
          )}
          <button className="search-action-btn" onClick={() => openFile(item.image_path)} aria-label={t("search.openImage")}>
            {t("search.openImage")}
          </button>
          <button className="search-action-btn" onClick={() => openFolder(item.image_path)} aria-label={t("search.openFolder")}>
            {t("search.openFolder")}
          </button>
        </div>
        <button
          className={`search-result-bookmark ${isBookmarked ? "bookmarked" : ""}`}
          onClick={(e) => { e.stopPropagation(); toggleBookmark(item.img_id); }}
          title={isBookmarked ? t("search.bookmarkRemove") : t("search.bookmarkAdd")}
          aria-label={isBookmarked ? t("search.bookmarkRemove") : t("search.bookmarkAdd")}
        >
          {isBookmarked ? "★" : "☆"}
        </button>
      </div>
    </div>
  );
}

type ResultGridCellProps = VirtualRowData & {
  columnIndex: number;
  rowIndex: number;
  style: React.CSSProperties;
  ariaAttributes: { "aria-colindex": number; role: "gridcell" };
};

function ResultGridCell({ columnIndex, rowIndex, style, items, selectedIds, brokenImgs, bookmarkedIds, _gridCols, t, toggleSelect, toggleBookmark, showContextMenu, onThumbEnter, onThumbLeave, onThumbClick, onImgError, prtFileMap, setPrtDirFilter }: ResultGridCellProps) {
  const index = rowIndex * _gridCols + columnIndex;
  if (index >= items.length) return null;
  const item = items[index];
  const gap = 8;
  const innerW = (style.width as number) - gap;
  const innerH = (style.height as number) - gap;
  const isSelected = selectedIds.has(item.img_id);
  const isBroken = brokenImgs.has(item.img_id);
  const isBookmarked = bookmarkedIds.has(item.img_id);
  const simClass = similarityClass(item.similarity);
  const itemPrtFiles = getItemPrtFiles(item, prtFileMap);
  const hasPrt = itemPrtFiles.length > 0;
  const itemDir = item.image_path ? extractDir(item.image_path) : extractDir(item.origin_path);

  return (
    <div style={{ ...style, width: (style.width as number), height: (style.height as number) }}>
      <div
        data-result-index={index}
        className={`search-result-item ${simClass} ${isSelected ? "selected" : ""}`}
        style={{ width: innerW, height: innerH, flexDirection: "column", padding: 0, overflow: "hidden" }}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            toggleSelect(item.img_id);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          showContextMenu(e, item);
        }}
      >
        <div
          className="search-result-thumb"
          style={{ width: "100%", height: "auto", aspectRatio: "1", borderRadius: 0, border: "none", borderBottom: "var(--border-width) solid var(--border)" }}
          onMouseEnter={(e) => onThumbEnter(e, item)}
          onMouseLeave={onThumbLeave}
          onClick={(e) => onThumbClick(e, item)}
          title={t("search.openImage")}
        >
          <LazyThumbnail
            imagePath={item.image_path}
            imgId={item.img_id}
            broken={isBroken}
            onError={() => onImgError(item.img_id)}
            noPreviewText={t("search.noPreview")}
          />
        </div>
        <div className="search-result-info" style={{ padding: "var(--space-2) var(--space-3)", gap: "var(--space-1)" }}>
          <div className="search-result-header" style={{ flexWrap: "wrap" }}>
            <span className="search-result-id" title={item.img_id} style={{ fontSize: "var(--text-xs)", fontWeight: 600 }}>{item.img_id}</span>
            <span className={`search-result-similarity ${simClass}`} style={{ fontSize: 10 }}>{formatSimilarity(item.similarity)}</span>
          </div>
          {item.source_query_indices && item.source_query_indices.length > 0 && (
            <div className="search-result-source-queries">
              {item.source_query_indices.map((qi) => (
                <span key={qi} className="search-source-query-badge" title={t("search.matchedSource", { index: String(qi + 1) })}>
                  #{qi + 1}
                </span>
              ))}
            </div>
          )}
          <div className="search-result-meta" style={{ gap: "var(--space-2)" }}>
            <span className={`search-result-source-badge ${item.source_type}`} style={{ fontSize: 10 }}>
              {item.source_type === "excel-embedded" ? t("search.sourceExcelEmbedded") : item.source_type === "ug-preview" ? t("search.sourceUgPreview") : item.source_type}
            </span>
            <span className="search-result-path" title={item.origin_path} style={{ fontSize: 11 }}>{extractFilename(item.origin_path)}</span>
          </div>
          {(item.width != null || item.format || item.size_bytes != null) && (
            <div className="search-result-meta-info">
              {item.width != null && item.height != null && <span>{item.width}×{item.height}</span>}
              {item.width != null && item.height != null && item.format && <span className="meta-sep">·</span>}
              {item.format && <span>{item.format}</span>}
              {item.format && item.size_bytes != null && <span className="meta-sep">·</span>}
              {item.size_bytes != null && <span>{formatFileSize(item.size_bytes)}</span>}
            </div>
          )}
          {item.ocr_text && (
            <div className="search-result-detail" style={{ marginTop: 0, fontSize: 10 }}>
              <span className="search-ocr-label">{t("search.ocrLabel")}:</span>
              <span className="search-ocr-text" title={item.ocr_text}>
                {item.ocr_text.length > 30 ? item.ocr_text.slice(0, 30) + "..." : item.ocr_text}
              </span>
            </div>
          )}
          {item.source_type === "excel-embedded" && item.sheet_name && (
            <div className="search-result-detail" style={{ marginTop: 0, fontSize: 10 }}>
              <span className="detail-label" style={{ fontSize: 10 }}>{t("search.sheet")}:</span>
              <span className="detail-value" style={{ fontSize: 10 }}>{item.sheet_name}</span>
              {item.row_number != null && (
                <>
                  <span className="detail-label" style={{ fontSize: 10 }}>{t("search.row")}:</span>
                  <span className="detail-value" style={{ fontSize: 10 }}>R{item.row_number}</span>
                </>
              )}
            </div>
          )}
          {item.ug_ref && (
            <div className="search-result-detail" style={{ marginTop: 0, fontSize: 10 }}>
              <span className="detail-label" style={{ fontSize: 10 }}>UG:</span>
              <span className="detail-value" style={{ fontSize: 10 }}>{item.ug_ref}</span>
            </div>
          )}
          {hasPrt && (
            <div className="search-result-detail" style={{ marginTop: 0, fontSize: 10 }}>
              <span className="detail-label" style={{ fontSize: 10, color: "var(--accent)" }}>PRT:</span>
              <button
                className="search-result-prt-link"
                onClick={(e) => { e.stopPropagation(); setPrtDirFilter(itemDir); }}
                title={t("search.filterByPrtDir")}
                style={{ fontSize: 10 }}
              >
                {itemPrtFiles.length === 1
                  ? extractFilename(itemPrtFiles[0])
                  : t("search.prtFileCount", { count: String(itemPrtFiles.length) })}
              </button>
            </div>
          )}
          {(hasPrt || item.source_type === "ug-preview" || item.source_type === "excel-embedded") && (
            <div className="search-result-actions" style={{ display: "flex", gap: 4, marginTop: 4 }}>
              {hasPrt && (
                <button className="search-action-btn search-action-primary" onClick={() => openFile(itemPrtFiles[0])} aria-label={t("search.openPrt")} style={{ fontSize: 10, padding: "2px 6px" }}>
                  {t("search.openPrt")}
                </button>
              )}
              <button className="search-action-btn" onClick={() => openFile(item.image_path)} aria-label={t("search.openImage")} style={{ fontSize: 10, padding: "2px 6px" }}>
                {t("search.openImage")}
              </button>
            </div>
          )}
        </div>
        <button
          className={`search-result-bookmark ${isBookmarked ? "bookmarked" : ""}`}
          onClick={(e) => { e.stopPropagation(); toggleBookmark(item.img_id); }}
          title={isBookmarked ? t("search.bookmarkRemove") : t("search.bookmarkAdd")}
          aria-label={isBookmarked ? t("search.bookmarkRemove") : t("search.bookmarkAdd")}
          style={{ top: "var(--space-2)", right: "var(--space-2)", fontSize: 20, background: "oklch(0% 0 0 / 0.25)", borderRadius: "50%", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {isBookmarked ? "★" : "☆"}
        </button>
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function fileToUrl(filePath: string): string | null {
  if (!filePath || !filePath.trim()) return null;
  return convertFileSrc(filePath);
}

function formatSimilarity(sim: number): string {
  return `${(sim * 100).toFixed(1)}%`;
}

function formatLastScan(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function similarityClass(sim: number): string {
  if (sim > 0.8) return "high";
  if (sim > 0.5) return "mid";
  return "low";
}

function extractFilename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
}

function extractDir(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  parts.pop();
  return parts.join("/") || filePath;
}

function autoDetectPrtFiles(
  results: { image_path: string; origin_path: string; prt_files?: string[] }[],
  setPrtFileMap: (map: Record<string, string[]>) => void,
) {
  const map: Record<string, string[]> = {};
  for (const r of results) {
    if (r.prt_files && r.prt_files.length > 0) {
      const dir = r.image_path ? extractDir(r.image_path) : extractDir(r.origin_path);
      if (dir && !map[dir]) {
        map[dir] = r.prt_files;
      }
    }
  }
  setPrtFileMap(map);
}

function getItemPrtFiles(item: SearchResultItem, prtFileMap: Record<string, string[]>): string[] {
  const dirs = new Set<string>();
  if (item.image_path) dirs.add(extractDir(item.image_path));
  if (item.origin_path) dirs.add(extractDir(item.origin_path));
  for (const dir of dirs) {
    const files = prtFileMap[dir];
    if (files && files.length > 0) return files;
  }
  return [];
}

export default function Search() {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [state, setState] = useState<SearchState>("idle");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [queryImages, setQueryImages] = useState<QueryImage[]>([]);
  const [isBatchSearch, setIsBatchSearch] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [selectedLibraryId, setSelectedLibraryId] = useState<number | null>(null);
  const [libraries, setLibraries] = useState<Library[]>([]);
  const [modelPercent, setModelPercent] = useState(0);
  const [modelMsg, setModelMsg] = useState("");
  const [brokenImgs, setBrokenImgs] = useState<Set<string>>(new Set());
  const [hoverPreview, setHoverPreview] = useState<{
    visible: boolean;
    x: number;
    y: number;
    imgPath: string;
  }>({ visible: false, x: 0, y: 0, imgPath: "" });
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => getHistory());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingSearchRef = useRef<{
    type: "base64" | "path";
    base64?: string;
    path?: string;
    url: string;
  } | null>(null);
  const escapeEpoch = useAtomValue(escapeEpochAtom);
  const setSplash = useSetAtom(splashStateAtom);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [compareItems, setCompareItems] = useState<[SearchResultItem, SearchResultItem] | null>(null);
  const [detailItem, setDetailItem] = useState<SearchResultItem | null>(null);
  const [filterText, setFilterText] = useState("");
  const [prtFileMap, setPrtFileMap] = useState<Record<string, string[]>>({});
  const [prtDirFilter, setPrtDirFilter] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<ExportProgress | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [focusedResultIdx, setFocusedResultIdx] = useState(-1);
  const PAGE_SIZE = 20;
  const VIRTUAL_SCROLL_THRESHOLD = 200;
  const [page, setPage] = useState(0);
  const [sortBy, setSortBy] = useState<SortKey>("similarity");
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    return (localStorage.getItem("searchViewMode") as "list" | "grid" | null) || "list";
  });

  useEffect(() => {
    localStorage.setItem("searchViewMode", viewMode);
  }, [viewMode]);

  const THUMB_SIZES = { s: 60, m: 100, l: 160 } as const;
  const [thumbSize, setThumbSize] = useState<keyof typeof THUMB_SIZES>(() => {
    return (localStorage.getItem("searchThumbSize") as keyof typeof THUMB_SIZES | null) || "m";
  });

  useEffect(() => {
    localStorage.setItem("searchThumbSize", thumbSize);
  }, [thumbSize]);

  // Virtual scroll: container measurement
  const virtContainerRef = useRef<HTMLDivElement>(null);
  const [virtDims, setVirtDims] = useState({ width: 800, height: 600 });
  const thumbPx = THUMB_SIZES[thumbSize];
  const listRowHeight = thumbPx + 48; // thumb + padding + gap
  const gridColCount = Math.max(1, Math.floor((virtDims.width - 16) / 190));
  const gridColWidth = Math.floor((virtDims.width - 16) / gridColCount);
  const gridRowHeight = gridColWidth + 140; // square thumb + info section

  useEffect(() => {
    const el = virtContainerRef.current;
    if (!el) return;
    const measure = () => {
      if (!virtContainerRef.current) return;
      const rect = virtContainerRef.current.getBoundingClientRect();
      const availableH = window.innerHeight - rect.top - 48;
      setVirtDims({ width: rect.width, height: Math.max(300, availableH) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const SIMILARITY_THRESHOLD_KEY = "similarityThreshold";
  const BOOKMARKS_KEY = "searchBookmarks";
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(BOOKMARKS_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return new Set(arr);
      }
    } catch { /* ignore */ }
    return new Set<string>();
  });

  useEffect(() => {
    localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...bookmarkedIds]));
  }, [bookmarkedIds]);

  const [bookmarkFilter, setBookmarkFilter] = useState(false);

  const [similarityThreshold] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(SIMILARITY_THRESHOLD_KEY);
      if (saved) {
        const n = parseInt(saved, 10);
        if (!isNaN(n) && n >= 0 && n <= 100) return n;
      }
    } catch { /* ignore */ }
    return 30;
  });

  const toggleBookmark = useCallback((imgId: string) => {
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (next.has(imgId)) {
        next.delete(imgId);
      } else {
        next.add(imgId);
      }
      return next;
    });
  }, []);

  const { data: stats } = useServiceQuery<SystemStats>("dbService", "db.getStats");
  const [ctxMenu, setCtxMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    item: SearchResultItem | null;
  }>({ visible: false, x: 0, y: 0, item: null });

  const filteredResults = useMemo(() => {
    if (!results) return [];
    let items = results.results;

    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase();
      items = items.filter(item =>
        item.img_id.toLowerCase().includes(q) ||
        item.origin_path.toLowerCase().includes(q) ||
        (item.ug_ref && item.ug_ref.toLowerCase().includes(q)) ||
        (item.sheet_name && item.sheet_name.toLowerCase().includes(q)) ||
        (item.ocr_text && item.ocr_text.toLowerCase().includes(q))
      );
    }

    if (bookmarkFilter) {
      items = items.filter(item => bookmarkedIds.has(item.img_id));
    }

    if (prtDirFilter) {
      items = items.filter(item => {
        const dir = item.image_path ? extractDir(item.image_path) : extractDir(item.origin_path);
        return dir === prtDirFilter;
      });
    }

    const threshold = similarityThreshold / 100;
    items = items.filter(item => item.similarity >= threshold);

    const sorted = [...items];
    switch (sortBy) {
      case "filename":
        sorted.sort((a, b) => {
          const fa = extractFilename(a.origin_path).toLowerCase();
          const fb = extractFilename(b.origin_path).toLowerCase();
          return fa.localeCompare(fb);
        });
        break;
      case "ug_ref":
        sorted.sort((a, b) => {
          const ua = (a.ug_ref || "").toLowerCase();
          const ub = (b.ug_ref || "").toLowerCase();
          return ua.localeCompare(ub) || b.similarity - a.similarity;
        });
        break;
      case "similarity":
      default:
        sorted.sort((a, b) => b.similarity - a.similarity);
        break;
    }

    return sorted;
  }, [results, filterText, sortBy, bookmarkFilter, bookmarkedIds, similarityThreshold, prtDirFilter]);

  // Reset page when filter, sort, or results change
  useEffect(() => {
    setPage(0);
    setFocusedResultIdx(-1);
  }, [filterText, sortBy, results]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));
  const pagedResults = filteredResults.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const useVirtualScroll = filteredResults.length > VIRTUAL_SCROLL_THRESHOLD;

  // Keyboard navigation: scroll focused result into view
  useEffect(() => {
    if (focusedResultIdx < 0 || !useVirtualScroll) return;
    setTimeout(() => {
      const el = document.querySelector(`[data-result-index="${focusedResultIdx}"]`);
      if (el) {
        el.scrollIntoView({ block: "nearest" });
      }
    }, 0);
  }, [focusedResultIdx, useVirtualScroll]);

  // Keyboard navigation for results
  const handleResultsKeyDown = useCallback((e: React.KeyboardEvent) => {
    const len = filteredResults.length;
    if (len === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedResultIdx((prev) => (prev < len - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedResultIdx((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && focusedResultIdx >= 0 && focusedResultIdx < len) {
      e.preventDefault();
      const item = filteredResults[focusedResultIdx];
      if (item) setDetailItem(item);
    }
  }, [filteredResults, focusedResultIdx]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (modelPollRef.current) clearInterval(modelPollRef.current);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // Listen for export progress events
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    exportService.onExportProgress((progress) => {
      setExportProgress(progress);
      if (progress.current >= progress.total) {
        setTimeout(() => {
          setExporting(false);
          setExportProgress(null);
        }, 1500);
      }
    }).then((fn) => { unlisten = fn; }).catch(() => {
      // Tauri event system not available (e.g. in test environment)
    });
    return () => { if (unlisten) unlisten(); };
  }, []);

  // Sync model-loading state to splash screen atom
  useEffect(() => {
    if (state === "model-loading") {
      setSplash({ visible: true, percent: modelPercent, message: modelMsg });
    } else {
      setSplash((prev) => (prev.visible ? { visible: false, percent: 0, message: "" } : prev));
    }
  }, [state, modelPercent, modelMsg, setSplash]);

  // Respond to Escape key: cancel scan, clear search
  useEffect(() => {
    if (modelPollRef.current) {
      clearInterval(modelPollRef.current);
      modelPollRef.current = null;
    }
    setState("idle");
    setResults(null);
    setErrorMsg("");
    setPreviewUrl("");
    setFilterText("");
    setPrtDirFilter(null);
    setPrtFileMap({});
    setSelectedIds(new Set());
    setDeleteConfirming(false);
    setDeleting(false);
  }, [escapeEpoch]);

  const waitForModel = useCallback((): Promise<void> => {
    const MODEL_POLL_TIMEOUT_MS = 130_000;
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const poll = async () => {
        if (Date.now() - startTime > MODEL_POLL_TIMEOUT_MS) {
          if (modelPollRef.current) clearInterval(modelPollRef.current);
          modelPollRef.current = null;
          reject(new Error("MODEL_TIMEOUT"));
          return;
        }
        try {
          const status = await searchService.getModelStatus();
          setModelPercent(status.percent);
          setModelMsg(status.message);
          if (status.status === "ready") {
            if (modelPollRef.current) clearInterval(modelPollRef.current);
            modelPollRef.current = null;
            resolve();
          } else if (status.status === "error") {
            if (modelPollRef.current) clearInterval(modelPollRef.current);
            modelPollRef.current = null;
            reject(new Error(status.error || status.message || "Model load failed"));
          }
        } catch (e) {
          if (modelPollRef.current) clearInterval(modelPollRef.current);
          modelPollRef.current = null;
          reject(e);
        }
      };

      // Poll immediately, then every 500ms
      poll();
      modelPollRef.current = setInterval(poll, 500);
    });
  }, []);

  // Fetch libraries for the selector dropdown
  useEffect(() => {
    libraryService.list().then(setLibraries).catch(() => {});
  }, []);

  const doSearch = useCallback(async (base64: string, displayUrl: string) => {
    setPreviewUrl(displayUrl);
    setQueryImages([]);
    setIsBatchSearch(false);
    setErrorMsg("");
    setResults(null);
    setSelectedIds(new Set());
    setDeleteConfirming(false);
    setDeleting(false);
    setFilterText("");
    setPrtDirFilter(null);
    setPrtFileMap({});
    pendingSearchRef.current = { type: "base64", base64, url: displayUrl };

    // Check model status first
    let modelFailed = false;
    try {
      const initialStatus = await searchService.getModelStatus();
      if (initialStatus.status !== "ready") {
        setState("model-loading");
        setModelPercent(initialStatus.percent);
        setModelMsg(initialStatus.message);
        try {
          await waitForModel();
        } catch (modelErr) {
          modelFailed = true;
          setState("error");
          const msg = modelErr instanceof Error ? modelErr.message : String(modelErr);
          setErrorMsg(msg);
          addToast("error", msg === "MODEL_TIMEOUT" ? t("search.modelTimeout") : msg);
          return;
        }
      }
    } catch {
      // If can't reach backend for status, try search anyway
    }

    if (modelFailed) return;

    setState("searching");

    try {
      const searchResults = await searchService.searchByImage(base64, 30, searchScope, selectedLibraryId ?? undefined);
      setResults(searchResults);
      setState("done");
      pendingSearchRef.current = null;

      autoDetectPrtFiles(searchResults.results, setPrtFileMap);

      // Save to search history
      createThumbnail(base64).then((thumb) => {
        const updated = addHistory({
          thumbnail: thumb,
          timestamp: Date.now(),
          resultCount: searchResults.count,
        });
        setHistory(updated);
      }).catch(() => {
        // Thumbnail creation failed; store without thumbnail
        const updated = addHistory({
          thumbnail: "",
          timestamp: Date.now(),
          resultCount: searchResults.count,
        });
        setHistory(updated);
      });
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
      addToast("error", e instanceof Error ? e.message : String(e));
    }
  }, [searchScope, selectedLibraryId, waitForModel, addToast, t]);

  const doSearchByPath = useCallback(async (filePath: string) => {
    setPreviewUrl(fileToUrl(filePath) || "");
    setErrorMsg("");
    setResults(null);
    setSelectedIds(new Set());
    setDeleteConfirming(false);
    setDeleting(false);
    setFilterText("");
    setPrtDirFilter(null);
    setPrtFileMap({});
    pendingSearchRef.current = { type: "path", path: filePath, url: fileToUrl(filePath) || "" };

    let modelFailed = false;
    try {
      const initialStatus = await searchService.getModelStatus();
      if (initialStatus.status !== "ready") {
        setState("model-loading");
        setModelPercent(initialStatus.percent);
        setModelMsg(initialStatus.message);
        try {
          await waitForModel();
        } catch (modelErr) {
          modelFailed = true;
          setState("error");
          const msg = modelErr instanceof Error ? modelErr.message : String(modelErr);
          setErrorMsg(msg);
          addToast("error", msg === "MODEL_TIMEOUT" ? t("search.modelTimeout") : msg);
          return;
        }
      }
    } catch {
      // If can't reach backend for status, try search anyway
    }

    if (modelFailed) return;

    setState("searching");

    try {
      const searchResults = await searchService.searchByPath(filePath, 30, searchScope, selectedLibraryId ?? undefined);
      setResults(searchResults);
      setState("done");
      pendingSearchRef.current = null;

      autoDetectPrtFiles(searchResults.results, setPrtFileMap);

      const updated = addHistory({
        thumbnail: "",
        timestamp: Date.now(),
        resultCount: searchResults.count,
      });
      setHistory(updated);
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
      addToast("error", e instanceof Error ? e.message : String(e));
    }
  }, [searchScope, selectedLibraryId, waitForModel, addToast, t]);

  const handleRetryModel = useCallback(async () => {
    const pending = pendingSearchRef.current;
    if (!pending) {
      setState("idle");
      setErrorMsg("");
      return;
    }
    setErrorMsg("");
    try {
      await searchService.resetModel();
    } catch {
      // If reset fails, still try to proceed
    }
    if (pending.type === "base64" && pending.base64) {
      doSearch(pending.base64, pending.url);
    } else if (pending.type === "path" && pending.path) {
      doSearchByPath(pending.path);
    } else {
      setState("idle");
    }
  }, [doSearch, doSearchByPath]);

  // Respond to --search CLI arg
  const startupSearchPath = useAtomValue(startupSearchPathAtom);
  const setStartupSearchPath = useSetAtom(startupSearchPathAtom);

  useEffect(() => {
    if (!startupSearchPath) return;
    const path = startupSearchPath;
    setStartupSearchPath(null);
    doSearchByPath(path);
  }, [startupSearchPath, doSearchByPath, setStartupSearchPath]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg(t("search.invalidFileType"));
      addToast("warning", t("search.invalidFileType"));
      return;
    }
    const base64 = await fileToBase64(file);
    const url = URL.createObjectURL(file);
    doSearch(base64, url);
  }, [doSearch, t, addToast]);

  const doBatchSearch = useCallback(async (images: QueryImage[]) => {
    setPreviewUrl("");
    setQueryImages(images);
    setIsBatchSearch(true);
    setErrorMsg("");
    setResults(null);
    setSelectedIds(new Set());
    setDeleteConfirming(false);
    setDeleting(false);
    setFilterText("");
    setPrtDirFilter(null);
    setPrtFileMap({});

    let modelFailed = false;
    try {
      const initialStatus = await searchService.getModelStatus();
      if (initialStatus.status !== "ready") {
        setState("model-loading");
        setModelPercent(initialStatus.percent);
        setModelMsg(initialStatus.message);
        try {
          await waitForModel();
        } catch (modelErr) {
          modelFailed = true;
          setState("error");
          const msg = modelErr instanceof Error ? modelErr.message : String(modelErr);
          setErrorMsg(msg);
          addToast("error", msg === "MODEL_TIMEOUT" ? t("search.modelTimeout") : msg);
          return;
        }
      }
    } catch {
      // If can't reach backend for status, try search anyway
    }

    if (modelFailed) return;

    setState("searching");

    try {
      const base64List = images.map((img) => img.base64);
      const batchResults = await searchService.batchSearchByImages(
        base64List, 30, searchScope, selectedLibraryId ?? undefined,
      );
      setResults(batchResults);
      setState("done");

      autoDetectPrtFiles(batchResults.results, setPrtFileMap);

      // Save first query image as search history thumbnail
      if (images.length > 0) {
        createThumbnail(images[0].base64).then((thumb) => {
          const updated = addHistory({
            thumbnail: thumb,
            timestamp: Date.now(),
            resultCount: batchResults.count,
          });
          setHistory(updated);
        }).catch(() => {
          const updated = addHistory({
            thumbnail: "",
            timestamp: Date.now(),
            resultCount: batchResults.count,
          });
          setHistory(updated);
        });
      }
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
      addToast("error", e instanceof Error ? e.message : String(e));
    }
  }, [searchScope, selectedLibraryId, waitForModel, addToast, t]);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const imageFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) {
      setErrorMsg(t("search.invalidFileType"));
      addToast("warning", t("search.invalidFileType"));
      return;
    }
    if (imageFiles.length === 1) {
      handleFile(imageFiles[0]);
      return;
    }

    // Multi-image batch search
    const images: QueryImage[] = [];
    for (const file of imageFiles) {
      try {
        const base64 = await fileToBase64(file);
        const url = URL.createObjectURL(file);
        images.push({ base64, url, name: file.name || `Image ${images.length + 1}` });
      } catch {
        addToast("warning", t("search.batchImageReadFailed", { name: file.name }));
      }
    }

    if (images.length === 0) return;
    if (images.length === 1) {
      doSearch(images[0].base64, images[0].url);
      return;
    }

    doBatchSearch(images);
  }, [handleFile, doSearch, doBatchSearch, t, addToast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  }, [handleFiles]);

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          handleFile(file);
        }
        break;
      }
    }
  }, [handleFile]);

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const sourceTypeLabel = useCallback((sourceType: string): string => {
    if (sourceType === "excel-embedded") return t("search.sourceExcelEmbedded");
    if (sourceType === "ug-preview") return t("search.sourceUgPreview");
    return sourceType;
  }, [t]);

  function escapeCsvField(val: string): string {
    if (val.includes(",") || val.includes("\"") || val.includes("\n") || val.includes("\r")) {
      return `"${val.replace(/"/g, "\"\"")}"`;
    }
    return val;
  }

  const handleExportCsv = useCallback(async () => {
    if (!results || results.results.length === 0) return;

    const filePath = await save({
      defaultPath: "search_results.csv",
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!filePath) return;

    try {
      const headers = [
        t("search.csvColumn.rank"),
        t("search.csvColumn.imageId"),
        t("search.csvColumn.sourceType"),
        t("search.csvColumn.similarity"),
        t("search.csvColumn.filePath"),
        t("search.csvColumn.ugNumber"),
        t("search.csvColumn.sheet"),
        t("search.csvColumn.row"),
      ];

      const rows = results.results.map((item, idx) => [
        String(idx + 1),
        item.img_id,
        sourceTypeLabel(item.source_type),
        formatSimilarity(item.similarity),
        item.image_path,
        item.ug_ref ?? "",
        item.sheet_name ?? "",
        item.row_number != null ? String(item.row_number) : "",
      ]);

      const bom = "﻿";
      const csvLines = [
        headers.map(escapeCsvField).join(","),
        ...rows.map((row) => row.map(escapeCsvField).join(",")),
      ];
      const csvContent = bom + csvLines.join("\n");

      await callTauri("write_text_file", { path: filePath, content: csvContent });
      addToast("success", t("search.exportSuccess"));
    } catch {
      addToast("error", t("search.exportFailed"));
    }
  }, [results, t, addToast, sourceTypeLabel]);

  const toggleSelect = useCallback((imgId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(imgId)) {
        next.delete(imgId);
      } else {
        next.add(imgId);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const getSelectedItems = useCallback((): SearchResultItem[] => {
    if (!results) return [];
    return results.results.filter((item) => selectedIds.has(item.img_id));
  }, [results, selectedIds]);

  const handleBatchOpenFolders = useCallback(async () => {
    const selected = getSelectedItems();
    for (const item of selected) {
      openFolder(extractDir(item.image_path));
    }
  }, [getSelectedItems]);

  const handleBatchExportCsv = useCallback(async () => {
    const selected = getSelectedItems();
    if (selected.length === 0) return;

    const filePath = await save({
      defaultPath: "search_results.csv",
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    });

    if (!filePath) return;

    try {
      const headers = [
        t("search.csvColumn.rank"),
        t("search.csvColumn.imageId"),
        t("search.csvColumn.sourceType"),
        t("search.csvColumn.similarity"),
        t("search.csvColumn.filePath"),
        t("search.csvColumn.ugNumber"),
        t("search.csvColumn.sheet"),
        t("search.csvColumn.row"),
      ];

      const rows = selected.map((item, idx) => [
        String(idx + 1),
        item.img_id,
        sourceTypeLabel(item.source_type),
        formatSimilarity(item.similarity),
        item.image_path,
        item.ug_ref ?? "",
        item.sheet_name ?? "",
        item.row_number != null ? String(item.row_number) : "",
      ]);

      const bom = "﻿";
      const csvLines = [
        headers.map(escapeCsvField).join(","),
        ...rows.map((row) => row.map(escapeCsvField).join(",")),
      ];
      const csvContent = bom + csvLines.join("\n");

      await callTauri("write_text_file", { path: filePath, content: csvContent });
      addToast("success", t("search.exportSuccess"));
    } catch {
      addToast("error", t("search.exportFailed"));
    }
  }, [getSelectedItems, t, addToast, sourceTypeLabel]);

  const handleBatchCopyPaths = useCallback(async () => {
    const selected = getSelectedItems();
    const paths = selected.map((item) => item.image_path).join("\n");
    await navigator.clipboard.writeText(paths);
    addToast("success", t("search.batchPathsCopied", { count: String(selected.length) }));
  }, [getSelectedItems, t, addToast]);

  const handleBatchCompare = useCallback(() => {
    const selected = getSelectedItems();
    if (selected.length !== 2) {
      addToast("warning", t("search.compareNeedTwo"));
      return;
    }
    setCompareItems([selected[0], selected[1]]);
  }, [getSelectedItems, t, addToast]);

  const handleSelectAll = useCallback(() => {
    const ids = new Set(filteredResults.map((item) => item.img_id));
    setSelectedIds(ids);
  }, [filteredResults]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBatchBookmark = useCallback(() => {
    const selected = getSelectedItems();
    if (selected.length === 0) return;
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      for (const item of selected) {
        next.add(item.img_id);
      }
      return next;
    });
    addToast("success", t("search.batchBookmarkSuccess", { count: String(selected.length) }));
    setSelectedIds(new Set());
  }, [getSelectedItems, t, addToast]);

  const handleBatchUnbookmark = useCallback(() => {
    const selected = getSelectedItems();
    if (selected.length === 0) return;
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      for (const item of selected) {
        next.delete(item.img_id);
      }
      return next;
    });
    addToast("success", t("search.batchUnbookmarkSuccess", { count: String(selected.length) }));
    setSelectedIds(new Set());
  }, [getSelectedItems, t, addToast]);

  const handleBatchDelete = useCallback(() => {
    if (getSelectedItems().length === 0) return;
    setDeleteConfirming(true);
  }, [getSelectedItems]);

  const handleBatchDeleteConfirm = useCallback(async () => {
    const selected = getSelectedItems();
    if (selected.length === 0) return;
    setDeleteConfirming(false);
    setDeleting(true);

    let successCount = 0;
    let failCount = 0;

    for (const item of selected) {
      try {
        await searchService.deleteEmbedding(item.img_id);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setDeleting(false);

    if (successCount > 0) {
      addToast("success", t("search.batchDeleteSuccess", { count: String(successCount) }));
    }
    if (failCount > 0) {
      addToast("error", t("search.batchDeleteFailed", { error: String(failCount) }));
    }

    // Remove deleted items from results
    if (results) {
      const deletedIds = new Set(selected.map((item) => item.img_id));
      setResults({
        ...results,
        results: results.results.filter((item) => !deletedIds.has(item.img_id)),
        count: results.count - successCount,
      });
    }
    setSelectedIds(new Set());
  }, [getSelectedItems, results, t, addToast]);

  const handleBatchDeleteCancel = useCallback(() => {
    setDeleteConfirming(false);
  }, []);

  const makeExportItems = useCallback((items: SearchResultItem[]): exportService.ExportItemInput[] => {
    return items.map((item) => ({
      image_path: item.image_path,
      img_id: item.img_id,
      origin_path: item.origin_path,
      similarity: item.similarity,
      source_type: item.source_type,
      sheet_name: item.sheet_name,
      row_number: item.row_number,
      ug_ref: item.ug_ref,
      ocr_text: item.ocr_text,
      width: item.width,
      height: item.height,
      format: item.format,
      size_bytes: item.size_bytes,
    }));
  }, []);

  const handleExportZip = useCallback(async () => {
    const items = filteredResults;
    if (items.length === 0) return;

    const { save } = await import("@tauri-apps/plugin-dialog");
    const filePath = await save({
      defaultPath: "search_results.zip",
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (!filePath) return;

    setExporting(true);
    try {
      await exportService.exportZip(filePath, makeExportItems(items));
      addToast("success", t("search.exportZipSuccess"));
    } catch (e) {
      setExporting(false);
      setExportProgress(null);
      addToast("error", t("search.exportZipFailed", { error: String(e instanceof Error ? e.message : e) }));
    }
  }, [filteredResults, makeExportItems, t, addToast]);

  const handleExportPdf = useCallback(async () => {
    const items = filteredResults;
    if (items.length === 0) return;

    const { save } = await import("@tauri-apps/plugin-dialog");
    const filePath = await save({
      defaultPath: "search_results.pdf",
      filters: [{ name: "PDF Document", extensions: ["pdf"] }],
    });
    if (!filePath) return;

    setExporting(true);
    try {
      await exportService.exportPdf(filePath, makeExportItems(items));
      addToast("success", t("search.exportPdfSuccess"));
    } catch (e) {
      setExporting(false);
      setExportProgress(null);
      addToast("error", t("search.exportPdfFailed", { error: String(e instanceof Error ? e.message : e) }));
    }
  }, [filteredResults, makeExportItems, t, addToast]);

  const handleBatchExportZip = useCallback(async () => {
    const selected = getSelectedItems();
    if (selected.length === 0) return;

    const { save } = await import("@tauri-apps/plugin-dialog");
    const filePath = await save({
      defaultPath: "search_results.zip",
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (!filePath) return;

    setExporting(true);
    try {
      await exportService.exportZip(filePath, makeExportItems(selected));
      addToast("success", t("search.exportZipSuccess"));
    } catch (e) {
      setExporting(false);
      setExportProgress(null);
      addToast("error", t("search.exportZipFailed", { error: String(e instanceof Error ? e.message : e) }));
    }
  }, [getSelectedItems, makeExportItems, t, addToast]);

  const handleBatchExportPdf = useCallback(async () => {
    const selected = getSelectedItems();
    if (selected.length === 0) return;

    const { save } = await import("@tauri-apps/plugin-dialog");
    const filePath = await save({
      defaultPath: "search_results.pdf",
      filters: [{ name: "PDF Document", extensions: ["pdf"] }],
    });
    if (!filePath) return;

    setExporting(true);
    try {
      await exportService.exportPdf(filePath, makeExportItems(selected));
      addToast("success", t("search.exportPdfSuccess"));
    } catch (e) {
      setExporting(false);
      setExportProgress(null);
      addToast("error", t("search.exportPdfFailed", { error: String(e instanceof Error ? e.message : e) }));
    }
  }, [getSelectedItems, makeExportItems, t, addToast]);

  const handleCopyImageToClipboard = useCallback(async (imagePath: string) => {
    try {
      await exportService.copyImageToClipboard(imagePath);
      addToast("success", t("search.imageCopied"));
    } catch (e) {
      addToast("error", t("search.imageCopyFailed", { error: String(e instanceof Error ? e.message : e) }));
    }
  }, [t, addToast]);

  const virtRowData = useMemo<VirtualRowData>(() => ({
    items: filteredResults,
    selectedIds,
    brokenImgs,
    bookmarkedIds,
    thumbPx,
    _gridCols: gridColCount,
    t,
    toggleSelect,
    toggleBookmark,
    showContextMenu: (e: React.MouseEvent, item: SearchResultItem) => {
      setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, item });
    },
    onThumbEnter: (e: React.MouseEvent<HTMLDivElement>, item: SearchResultItem) => {
      if (brokenImgs.has(item.img_id)) return;
      const thumb = e.currentTarget;
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = setTimeout(() => {
        const rect = thumb.getBoundingClientRect();
        const gap = 12;
        const pw = 400;
        const ph = 400;
        let px = rect.right + gap;
        let py = rect.top + rect.height / 2 - ph / 2;
        if (px + pw > window.innerWidth - gap) px = rect.left - pw - gap;
        if (py < gap) py = gap;
        if (py + ph > window.innerHeight - gap) py = window.innerHeight - ph - gap;
        setHoverPreview({ visible: true, x: px, y: py, imgPath: item.image_path });
      }, 300);
    },
    onThumbLeave: () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      setHoverPreview({ visible: false, x: 0, y: 0, imgPath: "" });
    },
    onThumbClick: (e: React.MouseEvent<HTMLDivElement>, item: SearchResultItem) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        toggleSelect(item.img_id);
      } else {
        setDetailItem(item);
      }
    },
    onImgError: (imgId: string) => {
      setBrokenImgs((prev) => {
        if (prev.has(imgId)) return prev;
        const next = new Set(prev);
        next.add(imgId);
        return next;
      });
    },
    prtFileMap,
    setPrtDirFilter,
  }), [filteredResults, selectedIds, brokenImgs, bookmarkedIds, thumbPx, gridColCount, t, toggleSelect, toggleBookmark, setHoverPreview, setBrokenImgs, setCtxMenu, prtFileMap]);

  const showDropZone = state === "idle" || state === "done" || state === "error";

  return (
    <div className="search-page">
      <h2 className="page-title">{t("sidebar.nav.search")}</h2>

      {/* Dashboard summary */}
      <div className="search-summary">
        <div className="search-summary-card">
          <span className="search-summary-label">{t("search.summaryLibraries")}</span>
          <span className="search-summary-value">
            {stats ? (stats.libraries || t("search.summaryNoData")) : t("search.summaryNoData")}
          </span>
        </div>
        <div className="search-summary-card">
          <span className="search-summary-label">{t("search.summaryImages")}</span>
          <span className="search-summary-value">
            {stats ? (stats.images || t("search.summaryNoData")) : t("search.summaryNoData")}
          </span>
        </div>
        <div className="search-summary-card">
          <span className="search-summary-label">{t("search.summaryLastScan")}</span>
          <span className="search-summary-value">
            {stats?.lastScan ? formatLastScan(stats.lastScan) : t("search.summaryNever")}
          </span>
        </div>
      </div>

      {/* Drop zone */}
      <div
        className={`search-dropzone ${dragOver ? "drag-over" : ""} ${showDropZone ? "" : "hidden"}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="search-dropzone-content">
          <div className="search-dropzone-icon">+</div>
          <p className="search-dropzone-text">{t("search.dropHint")}</p>
          <p className="search-dropzone-sub">{t("search.dropSubHint")}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleFileSelect}
          aria-label={t("search.dropHint")}
        />
      </div>

      {/* Search history */}
      {history.length > 0 && (state === "idle" || state === "done") && (
        <div className="search-history">
          <div className="search-history-header">
            <span className="search-history-title">{t("search.historyTitle")}</span>
            <button
              className="search-history-clear-btn"
              onClick={() => {
                clearHistory();
                setHistory([]);
              }}
              aria-label={t("search.clearHistory")}
            >
              {t("search.clearHistory")}
            </button>
          </div>
          <div className="search-history-list">
            {history.map((item, idx) => (
              <div
                key={`${item.timestamp}-${idx}`}
                className="search-history-item"
                onClick={() => {
                  if (item.thumbnail) {
                    doSearch(item.thumbnail, item.thumbnail);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const updated = deleteHistoryByIndex(idx);
                  setHistory(updated);
                }}
                title={new Date(item.timestamp).toLocaleString()}
              >
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="search-history-thumb"
                  />
                ) : (
                  <div className="search-history-thumb search-history-thumb-placeholder">
                    ?
                  </div>
                )}
                <span className="search-history-count">{item.resultCount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search scope filter */}
      <div className="search-scope-bar">
        <span className="search-scope-label">{t("search.scopeLibraryLabel")}</span>
        <select
          className="search-library-select"
          value={selectedLibraryId ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            setSelectedLibraryId(val ? Number(val) : null);
          }}
          aria-label={t("search.scopeLibraryLabel")}
        >
          <option value="">{t("search.scopeLibraryAll")}</option>
          {libraries.map((lib) => (
            <option key={lib.id} value={lib.id}>
              {lib.label || lib.path}
            </option>
          ))}
        </select>
        <span className="search-scope-label">Filter:</span>
        <div className="search-scope-options">
          {([
            ["all", "search.scopeAll"],
            ["excel_only", "search.scopeExcelOnly"],
            ["ug_only", "search.scopeUgOnly"],
          ] as const).map(([val, labelKey]) => (
            <button
              key={val}
              className={`search-scope-btn ${searchScope === val ? "active" : ""}`}
              onClick={() => setSearchScope(val)}
              aria-label={t(labelKey)}
            >
              {t(labelKey)}
            </button>
          ))}
          <button
            className={`search-scope-btn ${bookmarkFilter ? "active" : ""}`}
            onClick={() => setBookmarkFilter((v) => !v)}
            title={t("search.bookmarkFilter")}
            aria-label={t("search.bookmarkFilter")}
          >
            ★ {t("search.bookmarkFilter")}
          </button>
        </div>
      </div>

      {/* Model loading progress */}
      {state === "model-loading" && (
        <div className="search-model-progress">
          <p className="search-model-progress-text">
            {modelMsg || t("search.modelLoading")}
          </p>
          <div className="search-model-progress-bar-container">
            <div
              className="search-model-progress-bar"
              style={{ width: `${Math.max(modelPercent, 2)}%` }}
            />
          </div>
          <p className="search-model-progress-pct">{modelPercent}%</p>
        </div>
      )}

      {/* Searching skeleton */}
      {state === "searching" && (
        <div className="search-results">
          <h3 className="search-results-title">{t("search.searching")}</h3>
          <div className="search-results-list">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="search-result-skeleton">
                <div className="skeleton skeleton-image" style={{ width: 80, height: 80 }} />
                <div className="search-result-skeleton-info">
                  <div className="skeleton skeleton-text" style={{ width: "40%" }} />
                  <div className="skeleton skeleton-text" style={{ width: "30%" }} />
                  <div className="skeleton skeleton-text" style={{ width: "60%" }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {state === "error" && errorMsg && (
        <div className="search-error">
          <p>
            {errorMsg === "MODEL_TIMEOUT"
              ? t("search.modelTimeout")
              : `${t("common.error")}: ${errorMsg}`}
          </p>
          {errorMsg === "MODEL_TIMEOUT" || errorMsg.includes("Model load failed") || errorMsg.includes("Missing Python package") ? (
            <button className="search-retry-btn" onClick={handleRetryModel} aria-label={t("common.retry")}>
              {t("common.retry")}
            </button>
          ) : (
            <button className="search-retry-btn" onClick={() => { setState("idle"); setErrorMsg(""); }} aria-label={t("common.retry")}>
              {t("common.retry")}
            </button>
          )}
        </div>
      )}

      {/* Query preview */}
      {previewUrl && !isBatchSearch && state === "done" && (
        <div className="search-query-preview">
          <img src={previewUrl} alt="Query" className="search-query-img" />
          <div className="search-query-meta">
            <p className="search-result-count">
              {t("search.foundResults", { count: String(results?.count ?? 0) })}
            </p>
            {results?.duration_ms !== undefined && (
              <p className="search-duration">{t("search.duration", { ms: String(results.duration_ms) })}</p>
            )}
          </div>
        </div>
      )}

      {/* Batch query preview */}
      {isBatchSearch && queryImages.length > 0 && state === "done" && (
        <div className="search-query-preview search-batch-query-preview">
          <div className="search-batch-query-strip">
            {queryImages.map((img, idx) => (
              <div key={idx} className="search-batch-query-thumb-wrapper" title={img.name}>
                <img src={img.url} alt={img.name} className="search-batch-query-thumb" />
                <span className="search-batch-query-index">{idx + 1}</span>
              </div>
            ))}
          </div>
          <div className="search-query-meta">
            <p className="search-result-count">
              {t("search.batchFoundResults", { count: String(results?.count ?? 0), qcount: String(queryImages.length) })}
            </p>
            {results?.duration_ms !== undefined && (
              <p className="search-duration">{t("search.duration", { ms: String(results.duration_ms) })}</p>
            )}
          </div>
        </div>
      )}

      {/* PRT directory filter */}
      {prtDirFilter && (
        <div className="search-filter-bar" style={{ padding: "var(--space-2) var(--space-3)", background: "var(--bg-surface)", border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)" }}>
          <span style={{ fontSize: "var(--text-sm)", color: "var(--accent)", fontWeight: 600 }}>PRT Dir:</span>
          <span style={{ fontSize: "var(--text-sm)", marginLeft: "var(--space-2)" }}>{prtDirFilter}</span>
          <Tooltip content={t("common.cancel")}>
            <button
              className="search-filter-clear"
              onClick={() => setPrtDirFilter(null)}
              aria-label={t("common.cancel")}
            >
              x
            </button>
          </Tooltip>
        </div>
      )}

      {/* Text filter */}
      {state === "done" && results && results.results.length > 0 && (
        <div className="search-filter-bar">
          <input
            type="text"
            className="search-filter-input"
            placeholder={t("search.filterPlaceholder")}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            aria-label={t("search.filterPlaceholder")}
          />
          {filterText.trim() && (
            <Tooltip content={t("common.cancel")}>
              <button
                className="search-filter-clear"
                onClick={() => setFilterText("")}
                aria-label={t("common.cancel")}
              >
                x
              </button>
            </Tooltip>
          )}
        </div>
      )}

      {/* Results */}
      {results && results.results.length > 0 && state === "done" && (
        <div className="search-results">
          <div className="search-results-header">
            <h3 className="search-results-title">{t("search.results")}</h3>
            <div className="search-sort-group">
              <label className="search-sort-label">{t("search.sortLabel")}</label>
              <select
                className="search-sort-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                aria-label={t("search.sortLabel")}
              >
                <option value="similarity">{t("search.sortSimilarity")}</option>
                <option value="filename">{t("search.sortFilename")}</option>
                <option value="ug_ref">{t("search.sortUgRef")}</option>
              </select>
            </div>
            <div className="search-view-toggle">
              <Tooltip content={t("search.viewList")}>
                <button
                  className={`search-view-btn ${viewMode === "list" ? "active" : ""}`}
                  onClick={() => setViewMode("list")}
                  aria-label={t("search.viewList")}
                >
                  {t("search.viewList")}
                </button>
              </Tooltip>
              <Tooltip content={t("search.viewGrid")}>
                <button
                  className={`search-view-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
                  aria-label={t("search.viewGrid")}
                >
                  {t("search.viewGrid")}
                </button>
              </Tooltip>
            </div>
            <div className="search-thumb-size-toggle">
              <Tooltip content={t("search.thumbSmall")}>
                <button
                  className={`search-thumb-size-btn ${thumbSize === "s" ? "active" : ""}`}
                  onClick={() => setThumbSize("s")}
                  aria-label={t("search.thumbSmall")}
                >
                  {t("search.thumbSmall")}
                </button>
              </Tooltip>
              <Tooltip content={t("search.thumbMedium")}>
                <button
                  className={`search-thumb-size-btn ${thumbSize === "m" ? "active" : ""}`}
                  onClick={() => setThumbSize("m")}
                  aria-label={t("search.thumbMedium")}
                >
                  {t("search.thumbMedium")}
                </button>
              </Tooltip>
              <Tooltip content={t("search.thumbLarge")}>
                <button
                  className={`search-thumb-size-btn ${thumbSize === "l" ? "active" : ""}`}
                  onClick={() => setThumbSize("l")}
                  aria-label={t("search.thumbLarge")}
                >
                  {t("search.thumbLarge")}
                </button>
              </Tooltip>
            </div>
            <button className="search-export-btn" onClick={handleExportCsv} disabled={exporting} aria-label={t("search.exportCsv")}>
              {t("search.exportCsv")}
            </button>
            <button className="search-export-btn" onClick={handleExportZip} disabled={exporting} aria-label={t("search.exportZip")}>
              {t("search.exportZip")}
            </button>
            <button className="search-export-btn" onClick={handleExportPdf} disabled={exporting} aria-label={t("search.exportPdf")}>
              {t("search.exportPdf")}
            </button>
          </div>

          {/* Batch toolbar */}
          {selectedIds.size > 0 && !deleteConfirming && (
            <div className="search-batch-toolbar">
              <span className="search-batch-count">
                {t("search.selectedCount", { count: String(selectedIds.size) })}
              </span>
              <div className="search-batch-actions">
                <button className="search-batch-btn" onClick={handleSelectAll} aria-label={t("search.selectAll")}>
                  {t("search.selectAll")}
                </button>
                <button className="search-batch-btn" onClick={handleDeselectAll} aria-label={t("search.deselectAll")}>
                  {t("search.deselectAll")}
                </button>
                <span className="search-batch-sep" />
                <button className="search-batch-btn" onClick={handleBatchOpenFolders} aria-label={t("search.batchOpenFolders")}>
                  {t("search.batchOpenFolders")}
                </button>
                <button className="search-batch-btn" onClick={handleBatchExportCsv} disabled={exporting} aria-label={t("search.batchExportCsv")}>
                  {t("search.batchExportCsv")}
                </button>
                <button className="search-batch-btn" onClick={handleBatchExportZip} disabled={exporting} aria-label={t("search.batchExportZip")}>
                  {t("search.batchExportZip")}
                </button>
                <button className="search-batch-btn" onClick={handleBatchExportPdf} disabled={exporting} aria-label={t("search.batchExportPdf")}>
                  {t("search.batchExportPdf")}
                </button>
                <button className="search-batch-btn" onClick={handleBatchCopyPaths} aria-label={t("search.batchCopyPaths")}>
                  {t("search.batchCopyPaths")}
                </button>
                <button className="search-batch-btn" onClick={handleBatchCompare} aria-label={t("search.batchCompare")}>
                  {t("search.batchCompare")}
                </button>
                <span className="search-batch-sep" />
                <button className="search-batch-btn" onClick={handleBatchBookmark} aria-label={t("search.batchBookmark")}>
                  {t("search.batchBookmark")}
                </button>
                <button className="search-batch-btn" onClick={handleBatchUnbookmark} aria-label={t("search.batchUnbookmark")}>
                  {t("search.batchUnbookmark")}
                </button>
                <button className="search-batch-btn search-batch-delete-btn" onClick={handleBatchDelete} aria-label={t("search.batchDelete")}>
                  {t("search.batchDelete")}
                </button>
                <span className="search-batch-sep" />
                <button className="search-batch-btn" onClick={clearSelection} aria-label={t("search.batchClearSelection")}>
                  {t("search.batchClearSelection")}
                </button>
              </div>
            </div>
          )}

          {/* Delete confirmation */}
          {deleteConfirming && (
            <div className="search-batch-toolbar search-batch-confirm">
              <span className="search-batch-confirm-text">
                {t("search.batchDeleteConfirm", { count: String(selectedIds.size) })}
              </span>
              <div className="search-batch-actions">
                <button
                  className="search-batch-btn search-batch-delete-confirm-btn"
                  onClick={handleBatchDeleteConfirm}
                  disabled={deleting}
                  aria-label={t("common.confirm")}
                >
                  {deleting ? t("common.loading") : t("common.confirm")}
                </button>
                <button
                  className="search-batch-btn"
                  onClick={handleBatchDeleteCancel}
                  disabled={deleting}
                  aria-label={t("common.cancel")}
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}

          {/* Export progress */}
          {exporting && exportProgress && (
            <div className="search-export-progress">
              <div className="search-export-progress-bar-container">
                <div
                  className="search-export-progress-bar"
                  style={{ width: `${exportProgress.total > 0 ? Math.round((exportProgress.current / exportProgress.total) * 100) : 0}%` }}
                />
              </div>
              <span className="search-export-progress-text">
                {exportProgress.message || t("search.exporting")}
              </span>
            </div>
          )}

          {filteredResults.length === 0 && (filterText.trim() || bookmarkFilter || similarityThreshold > 0) ? (
            <div className="search-filter-empty">
              {t("search.noFilterMatches")}
            </div>
          ) : (
            <>
            {useVirtualScroll ? (
              viewMode === "list" ? (
                <div ref={virtContainerRef} className="search-virt-container" tabIndex={0} onKeyDown={handleResultsKeyDown}>
                  <List
                    style={{ height: virtDims.height, width: virtDims.width }}
                    rowCount={filteredResults.length}
                    rowHeight={listRowHeight}
                    rowProps={virtRowData}
                    rowComponent={ResultListRow}
                    overscanCount={10}
                  />
                </div>
              ) : (
                <div ref={virtContainerRef} className="search-virt-container" tabIndex={0} onKeyDown={handleResultsKeyDown}>
                  <Grid
                    style={{ height: virtDims.height, width: virtDims.width }}
                    columnCount={gridColCount}
                    columnWidth={gridColWidth}
                    rowCount={Math.ceil(filteredResults.length / gridColCount)}
                    rowHeight={gridRowHeight}
                    cellProps={virtRowData}
                    cellComponent={ResultGridCell}
                    overscanCount={2}
                  />
                </div>
              )
            ) : (
            <div
              className={`search-results-list ${viewMode === "grid" ? "grid-view" : ""}`}
              style={{ "--thumb-size": `${THUMB_SIZES[thumbSize]}px` } as React.CSSProperties}
            >
            {pagedResults.map((item: SearchResultItem, idx: number) => (
              <div
                key={item.img_id}
                className={`search-result-item ${similarityClass(item.similarity)} ${selectedIds.has(item.img_id) ? "selected" : ""}`}
                data-result-index={idx}
                tabIndex={0}
                onFocus={() => setFocusedResultIdx(idx)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setFocusedResultIdx((prev) => Math.min(prev + 1, filteredResults.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setFocusedResultIdx((prev) => Math.max(prev - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    setDetailItem(item);
                  }
                }}
                onClick={(e) => {
                  if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    toggleSelect(item.img_id);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ visible: true, x: e.clientX, y: e.clientY, item });
                }}
              >
                <div className="search-result-rank">#{page * PAGE_SIZE + idx + 1}</div>
                <div
                  className="search-result-thumb"
                  onMouseEnter={(e) => {
                    if (brokenImgs.has(item.img_id)) return;
                    const thumb = e.currentTarget;
                    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                    hoverTimerRef.current = setTimeout(() => {
                      const rect = thumb.getBoundingClientRect();
                      const gap = 12;
                      const pw = 400;
                      const ph = 400;
                      let px = rect.right + gap;
                      let py = rect.top + rect.height / 2 - ph / 2;
                      if (px + pw > window.innerWidth - gap) {
                        px = rect.left - pw - gap;
                      }
                      if (py < gap) py = gap;
                      if (py + ph > window.innerHeight - gap) py = window.innerHeight - ph - gap;
                      setHoverPreview({ visible: true, x: px, y: py, imgPath: item.image_path });
                    }, 300);
                  }}
                  onMouseLeave={() => {
                    if (hoverTimerRef.current) {
                      clearTimeout(hoverTimerRef.current);
                      hoverTimerRef.current = null;
                    }
                    setHoverPreview({ visible: false, x: 0, y: 0, imgPath: "" });
                  }}
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      e.preventDefault();
                      toggleSelect(item.img_id);
                    } else {
                      setDetailItem(item);
                    }
                  }}
                  title={t("search.openImage")}
                >
                  <LazyThumbnail
                    imagePath={item.image_path}
                    imgId={item.img_id}
                    broken={brokenImgs.has(item.img_id)}
                    onError={() => {
                      setBrokenImgs((prev) => {
                        if (prev.has(item.img_id)) return prev;
                        const next = new Set(prev);
                        next.add(item.img_id);
                        return next;
                      });
                    }}
                    noPreviewText={t("search.noPreview")}
                  />
                </div>
                <div className="search-result-info">
                  <div className="search-result-header">
                    <span className="search-result-id" title={item.img_id}>
                      {item.img_id}
                    </span>
                    <span className={`search-result-similarity ${similarityClass(item.similarity)}`}>
                      {formatSimilarity(item.similarity)}
                    </span>
                  </div>
                  {item.source_query_indices && item.source_query_indices.length > 0 && (
                    <div className="search-result-source-queries">
                      {item.source_query_indices.map((qi) => (
                        <span key={qi} className="search-source-query-badge" title={t("search.matchedSource", { index: String(qi + 1) })}>
                          #{qi + 1}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="search-result-meta">
                    <span className={`search-result-source-badge ${item.source_type}`}>
                      {sourceTypeLabel(item.source_type)}
                    </span>
                    <span className="search-result-path" title={item.origin_path}>
                      {extractFilename(item.origin_path)}
                    </span>
                  </div>
                  {(item.width != null || item.format || item.size_bytes != null) && (
                    <div className="search-result-meta-info">
                      {item.width != null && item.height != null && (
                        <span>{item.width}×{item.height}</span>
                      )}
                      {item.width != null && item.height != null && item.format && (
                        <span className="meta-sep">·</span>
                      )}
                      {item.format && (
                        <span>{item.format}</span>
                      )}
                      {item.format && item.size_bytes != null && (
                        <span className="meta-sep">·</span>
                      )}
                      {item.size_bytes != null && (
                        <span>{formatFileSize(item.size_bytes)}</span>
                      )}
                    </div>
                  )}
                  {/* OCR text */}
                  {item.ocr_text && (
                    <div className="search-result-detail">
                      <span className="search-ocr-label">{t("search.ocrLabel")}:</span>
                      <span className="search-ocr-text" title={item.ocr_text}>
                        {item.ocr_text.length > 50
                          ? item.ocr_text.slice(0, 50) + "..."
                          : item.ocr_text}
                      </span>
                    </div>
                  )}
                  {/* Excel info */}
                  {item.source_type === "excel-embedded" && item.sheet_name && (
                    <div className="search-result-detail">
                      <span className="detail-label">{t("search.sheet")}:</span>
                      <span className="detail-value">{item.sheet_name}</span>
                      {item.row_number != null && (
                        <>
                          <span className="detail-label">{t("search.row")}:</span>
                          <span className="detail-value">R{item.row_number}</span>
                        </>
                      )}
                    </div>
                  )}
                  {/* UG ref */}
                  {item.ug_ref && (
                    <div className="search-result-detail">
                      <span className="detail-label">UG:</span>
                      <span className="detail-value">{item.ug_ref}</span>
                    </div>
                  )}
                  {/* PRT files */}
                  {(() => {
                    const pfs = getItemPrtFiles(item, prtFileMap);
                    const pDir = item.image_path ? extractDir(item.image_path) : extractDir(item.origin_path);
                    if (pfs.length > 0) {
                      return (
                        <div className="search-result-detail">
                          <span className="detail-label" style={{ color: "var(--accent)" }}>PRT:</span>
                          <button className="search-result-prt-link" onClick={(e) => { e.stopPropagation(); setPrtDirFilter(pDir); }} title={t("search.filterByPrtDir")}>
                            {pfs.length === 1 ? extractFilename(pfs[0]) : t("search.prtFileCount", { count: String(pfs.length) })}
                          </button>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <div className="search-result-actions">
                  {item.source_type === "excel-embedded" && (
                    <button
                      className="search-action-btn search-action-primary"
                      onClick={() => openFile(item.origin_path)}
                      aria-label={t("search.openExcel")}
                    >
                      {t("search.openExcel")}
                    </button>
                  )}
                  {item.source_type === "ug-preview" && (
                    <button
                      className="search-action-btn search-action-primary"
                      onClick={() => openFolder(item.origin_path)}
                      aria-label={t("search.openUgFolder")}
                    >
                      {t("search.openUgFolder")}
                    </button>
                  )}
                  {(() => {
                    const pfs = getItemPrtFiles(item, prtFileMap);
                    if (pfs.length > 0) {
                      return (
                        <button className="search-action-btn search-action-primary" onClick={() => openFile(pfs[0])} aria-label={t("search.openPrt")}>
                          {t("search.openPrt")}
                        </button>
                      );
                    }
                    return null;
                  })()}
                  <button
                    className="search-action-btn"
                    onClick={() => openFile(item.image_path)}
                    aria-label={t("search.openImage")}
                  >
                    {t("search.openImage")}
                  </button>
                  <button
                    className="search-action-btn"
                    onClick={() => openFolder(item.image_path)}
                    aria-label={t("search.openFolder")}
                  >
                    {t("search.openFolder")}
                  </button>
                </div>
                <button
                  className={`search-result-bookmark ${bookmarkedIds.has(item.img_id) ? "bookmarked" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleBookmark(item.img_id);
                  }}
                  title={bookmarkedIds.has(item.img_id) ? t("search.bookmarkRemove") : t("search.bookmarkAdd")}
                  aria-label={bookmarkedIds.has(item.img_id) ? t("search.bookmarkRemove") : t("search.bookmarkAdd")}
                >
                  {bookmarkedIds.has(item.img_id) ? "★" : "☆"}
                </button>
              </div>
            ))}
          </div>
            )}
          </>
          )}

          {!useVirtualScroll && filteredResults.length > PAGE_SIZE && (
            <div className="search-pagination">
              <button
                className="search-pagination-btn"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                aria-label={t("search.pagePrev")}
              >
                {t("search.pagePrev")}
              </button>
              <span className="search-pagination-info">
                {t("search.pageInfo", {
                  page: String(page + 1),
                  total: String(totalPages),
                  count: String(filteredResults.length),
                })}
              </span>
              <button
                className="search-pagination-btn"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                aria-label={t("search.pageNext")}
              >
                {t("search.pageNext")}
              </button>
            </div>
          )}
          {useVirtualScroll && (
            <div className="search-pagination" style={{ justifyContent: "center" }}>
              <span className="search-pagination-info">
                {t("search.pageInfo", {
                  page: "—",
                  total: "—",
                  count: String(filteredResults.length),
                })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* No results */}
      {results && results.results.length === 0 && state === "done" && (
        <EmptyState
          icon={<SearchEmptyIcon />}
          title={t("search.noResults")}
          description={t("search.noResultsDesc")}
        />
      )}

      {/* Hover preview */}
      {hoverPreview.visible && hoverPreview.imgPath && (
        <div
          className="search-hover-preview"
          style={{ left: hoverPreview.x, top: hoverPreview.y }}
          onMouseLeave={() => setHoverPreview({ visible: false, x: 0, y: 0, imgPath: "" })}
        >
          <img
            src={fileToUrl(hoverPreview.imgPath) || ""}
            alt="Preview"
            className="search-hover-preview-img"
          />
        </div>
      )}

      {/* Image compare modal */}
      {compareItems && (
        <ImageCompareModal
          open={true}
          itemA={compareItems[0]}
          itemB={compareItems[1]}
          onClose={() => setCompareItems(null)}
        />
      )}

      {/* Search detail panel */}
      <SearchDetailPanel
        open={detailItem !== null}
        item={detailItem}
        onClose={() => setDetailItem(null)}
      />

      {/* Context menu */}
      {ctxMenu.visible && ctxMenu.item && (() => {
        const item = ctxMenu.item;
        const menuItems: ContextMenuItem[] = [
          {
            label: t("search.openImage"),
            onClick: () => { openFile(item.image_path); },
          },
          {
            label: t("search.openContainingFolder"),
            onClick: () => { openFolder(extractDir(item.image_path)); },
          },
          { separator: true },
          {
            label: bookmarkedIds.has(item.img_id) ? t("search.bookmarkRemove") : t("search.bookmarkAdd"),
            onClick: () => { toggleBookmark(item.img_id); },
          },
          { separator: true },
          {
            label: t("search.copyPath"),
            onClick: () => {
              navigator.clipboard.writeText(item.image_path);
              addToast("success", t("search.copied"));
            },
          },
          {
            label: t("search.copyImageToClipboard"),
            onClick: () => { handleCopyImageToClipboard(item.image_path); },
          },
        ];
        if (item.ug_ref) {
          menuItems.push({
            label: t("search.copyUgNumber"),
            onClick: () => {
              navigator.clipboard.writeText(item.ug_ref!);
              addToast("success", t("search.copied"));
            },
          });
        }
        {
          const prtFiles = getItemPrtFiles(item, prtFileMap);
          if (prtFiles.length > 0) {
            menuItems.push({ separator: true });
            menuItems.push({
              label: t("search.openPrt"),
              onClick: () => { openFile(prtFiles[0]); },
            });
            menuItems.push({
              label: t("search.filterByPrtDir"),
              onClick: () => {
                const dir = item.image_path ? extractDir(item.image_path) : extractDir(item.origin_path);
                setPrtDirFilter(dir);
              },
            });
          }
        }
        return (
          <ContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            items={menuItems}
            onClose={() => setCtxMenu((prev) => ({ ...prev, visible: false }))}
          />
        );
      })()}
    </div>
  );
}
