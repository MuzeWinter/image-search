import { useState, useRef, useCallback, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useI18n } from "../i18n/context";
import * as searchService from "../services/searchService";
import type { SearchScope, SearchResultItem, SearchResults } from "../services/searchService";
import { openFile, openFolder } from "../services/systemService";

type SearchState = "idle" | "model-loading" | "searching" | "done" | "error";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function fileToUrl(filePath: string): string {
  return convertFileSrc(filePath);
}

function formatSimilarity(sim: number): string {
  return `${(sim * 100).toFixed(1)}%`;
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

export default function Search() {
  const { t } = useI18n();
  const [state, setState] = useState<SearchState>("idle");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [modelPercent, setModelPercent] = useState(0);
  const [modelMsg, setModelMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup model poll on unmount
  useEffect(() => {
    return () => {
      if (modelPollRef.current) clearInterval(modelPollRef.current);
    };
  }, []);

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

  const doSearch = useCallback(async (base64: string, displayUrl: string) => {
    setPreviewUrl(displayUrl);
    setErrorMsg("");
    setResults(null);

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
      const searchResults = await searchService.searchByImage(base64, 30, searchScope);
      setResults(searchResults);
      setState("done");
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  }, [searchScope, waitForModel]);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg(t("search.invalidFileType"));
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

  const showDropZone = state === "idle" || state === "done" || state === "error";

  return (
    <div className="search-page">
      <h2 className="page-title">{t("sidebar.nav.search")}</h2>

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

      {/* Search scope filter */}
      <div className="search-scope-bar">
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

      {/* Results */}
      {results && results.results.length > 0 && state === "done" && (
        <div className="search-results">
          <h3 className="search-results-title">{t("search.results")}</h3>
          <div className="search-results-list">
            {results.results.map((item: SearchResultItem, idx: number) => (
              <div key={item.img_id} className="search-result-item">
                <div className="search-result-rank">#{idx + 1}</div>
                <div
                  className="search-result-thumb"
                  onClick={() => openFile(item.image_path)}
                  title={t("search.openImage")}
                >
                  <img
                    src={fileToUrl(item.image_path)}
                    alt={item.img_id}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
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
        </div>
      )}

      {/* No results */}
      {results && results.results.length === 0 && state === "done" && (
        <div className="search-empty">
          <p className="search-empty-icon">&#x1F50D;</p>
          <p className="search-empty-title">{t("search.noResults")}</p>
          <p className="search-empty-desc">{t("search.noResultsDesc")}</p>
        </div>
      )}
    </div>
  );
}
