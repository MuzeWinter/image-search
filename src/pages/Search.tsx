import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { convertFileSrc } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../i18n/context";
import { useToast } from "../contexts/ToastContext";
import * as searchService from "../services/searchService";
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

function extractDir(filePath: string): string {
  const parts = filePath.replace(/\\/g, "/").split("/");
  parts.pop();
  return parts.join("/") || filePath;
}

export default function Search() {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [state, setState] = useState<SearchState>("idle");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
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
  const escapeEpoch = useAtomValue(escapeEpochAtom);
  const setSplash = useSetAtom(splashStateAtom);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterText, setFilterText] = useState("");
  const PAGE_SIZE = 20;
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
  }, [results, filterText, sortBy]);

  // Reset page when filter, sort, or results change
  useEffect(() => {
    setPage(0);
  }, [filterText, sortBy, results]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE));
  const pagedResults = filteredResults.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (modelPollRef.current) clearInterval(modelPollRef.current);
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
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
  }, [escapeEpoch]);

  const waitForModel = useCallback((): Promise<void> => {
    return new Promise((resolve, reject) => {
      const poll = async () => {
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
    setErrorMsg("");
    setResults(null);
    setSelectedIds(new Set());
    setFilterText("");

    // Check model status first
    try {
      const initialStatus = await searchService.getModelStatus();
      if (initialStatus.status !== "ready") {
        setState("model-loading");
        setModelPercent(initialStatus.percent);
        setModelMsg(initialStatus.message);
        await waitForModel();
      }
    } catch {
      // If can't reach backend for status, try search anyway
    }

    setState("searching");

    try {
      const searchResults = await searchService.searchByImage(base64, 30, searchScope, selectedLibraryId ?? undefined);
      setResults(searchResults);
      setState("done");

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
  }, [searchScope, selectedLibraryId, waitForModel, addToast]);

  const doSearchByPath = useCallback(async (filePath: string) => {
    setPreviewUrl(fileToUrl(filePath) || "");
    setErrorMsg("");
    setResults(null);
    setSelectedIds(new Set());
    setFilterText("");

    try {
      const initialStatus = await searchService.getModelStatus();
      if (initialStatus.status !== "ready") {
        setState("model-loading");
        setModelPercent(initialStatus.percent);
        setModelMsg(initialStatus.message);
        await waitForModel();
      }
    } catch {
      // If can't reach backend for status, try search anyway
    }

    setState("searching");

    try {
      const searchResults = await searchService.searchByPath(filePath, 30, searchScope, selectedLibraryId ?? undefined);
      setResults(searchResults);
      setState("done");

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
  }, [searchScope, selectedLibraryId, waitForModel, addToast]);

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
  }, [doSearch, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

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
      handleFile(files[0]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const sourceTypeLabel = (sourceType: string): string => {
    if (sourceType === "excel-embedded") return t("search.sourceExcelEmbedded");
    if (sourceType === "ug-preview") return t("search.sourceUgPreview");
    return sourceType;
  };

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
    } catch (e) {
      addToast("error", t("search.exportFailed"));
    }
  }, [results, t, addToast]);

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
    } catch (e) {
      addToast("error", t("search.exportFailed"));
    }
  }, [getSelectedItems, t, addToast]);

  const handleBatchCopyPaths = useCallback(async () => {
    const selected = getSelectedItems();
    const paths = selected.map((item) => item.image_path).join("\n");
    await navigator.clipboard.writeText(paths);
    addToast("success", t("search.batchPathsCopied", { count: String(selected.length) }));
  }, [getSelectedItems, t, addToast]);

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
          style={{ display: "none" }}
          onChange={handleFileSelect}
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
            >
              {t(labelKey)}
            </button>
          ))}
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
          <p>{t("common.error")}: {errorMsg}</p>
          <button className="search-retry-btn" onClick={() => { setState("idle"); setErrorMsg(""); }}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {/* Query preview */}
      {previewUrl && state === "done" && (
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

      {/* Text filter */}
      {state === "done" && results && results.results.length > 0 && (
        <div className="search-filter-bar">
          <input
            type="text"
            className="search-filter-input"
            placeholder={t("search.filterPlaceholder")}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          {filterText.trim() && (
            <Tooltip content={t("common.cancel")}>
              <button
                className="search-filter-clear"
                onClick={() => setFilterText("")}
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
                >
                  {t("search.viewList")}
                </button>
              </Tooltip>
              <Tooltip content={t("search.viewGrid")}>
                <button
                  className={`search-view-btn ${viewMode === "grid" ? "active" : ""}`}
                  onClick={() => setViewMode("grid")}
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
                >
                  {t("search.thumbSmall")}
                </button>
              </Tooltip>
              <Tooltip content={t("search.thumbMedium")}>
                <button
                  className={`search-thumb-size-btn ${thumbSize === "m" ? "active" : ""}`}
                  onClick={() => setThumbSize("m")}
                >
                  {t("search.thumbMedium")}
                </button>
              </Tooltip>
              <Tooltip content={t("search.thumbLarge")}>
                <button
                  className={`search-thumb-size-btn ${thumbSize === "l" ? "active" : ""}`}
                  onClick={() => setThumbSize("l")}
                >
                  {t("search.thumbLarge")}
                </button>
              </Tooltip>
            </div>
            <button className="search-export-btn" onClick={handleExportCsv}>
              {t("search.exportCsv")}
            </button>
          </div>

          {/* Batch toolbar */}
          {selectedIds.size > 0 && (
            <div className="search-batch-toolbar">
              <span className="search-batch-count">
                {t("search.selectedCount", { count: String(selectedIds.size) })}
              </span>
              <div className="search-batch-actions">
                <button className="search-batch-btn" onClick={handleBatchOpenFolders}>
                  {t("search.batchOpenFolders")}
                </button>
                <button className="search-batch-btn" onClick={handleBatchExportCsv}>
                  {t("search.batchExportCsv")}
                </button>
                <button className="search-batch-btn" onClick={handleBatchCopyPaths}>
                  {t("search.batchCopyPaths")}
                </button>
                <button className="search-batch-btn" onClick={clearSelection}>
                  {t("search.batchClearSelection")}
                </button>
              </div>
            </div>
          )}

          {filteredResults.length === 0 && filterText.trim() ? (
            <div className="search-filter-empty">
              {t("search.noFilterMatches")}
            </div>
          ) : (
            <div
              className={`search-results-list ${viewMode === "grid" ? "grid-view" : ""}`}
              style={{ "--thumb-size": `${THUMB_SIZES[thumbSize]}px` } as React.CSSProperties}
            >
            {pagedResults.map((item: SearchResultItem, idx: number) => (
              <div
                key={item.img_id}
                className={`search-result-item ${similarityClass(item.similarity)} ${selectedIds.has(item.img_id) ? "selected" : ""}`}
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
                      openFile(item.image_path);
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
                  <div className="search-result-meta">
                    <span className={`search-result-source-badge ${item.source_type}`}>
                      {sourceTypeLabel(item.source_type)}
                    </span>
                    <span className="search-result-path" title={item.origin_path}>
                      {extractFilename(item.origin_path)}
                    </span>
                  </div>
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
                </div>
                <div className="search-result-actions">
                  {item.source_type === "excel-embedded" && (
                    <button
                      className="search-action-btn search-action-primary"
                      onClick={() => openFile(item.origin_path)}
                    >
                      {t("search.openExcel")}
                    </button>
                  )}
                  {item.source_type === "ug-preview" && (
                    <button
                      className="search-action-btn search-action-primary"
                      onClick={() => openFolder(item.origin_path)}
                    >
                      {t("search.openUgFolder")}
                    </button>
                  )}
                  <button
                    className="search-action-btn"
                    onClick={() => openFile(item.image_path)}
                  >
                    {t("search.openImage")}
                  </button>
                </div>
              </div>
            ))}
          </div>
          )}

          {filteredResults.length > PAGE_SIZE && (
            <div className="search-pagination">
              <button
                className="search-pagination-btn"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
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
              >
                {t("search.pageNext")}
              </button>
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
            label: t("search.copyPath"),
            onClick: () => {
              navigator.clipboard.writeText(item.image_path);
              addToast("success", t("search.copied"));
            },
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
