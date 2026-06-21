import { useState, useRef, useCallback, useEffect } from "react";
import { useI18n } from "../i18n/context";
import * as searchService from "../services/searchService";
import * as aiService from "../services/aiService";
import * as ocrService from "../services/ocrService";
import type { SearchResultItem, SearchResults } from "../services/searchService";
import type { ModelStatus } from "../services/aiService";

type SearchState = "idle" | "loading-model" | "searching" | "done" | "error";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function fileToUrl(filePath: string): string {
  return `asset://localhost/${encodeURI(filePath.replace(/\\/g, "/"))}`;
}

async function openFile(filePath: string) {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(filePath);
  } catch {
    // silently fail
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // silently fail
  }
}

function formatSimilarity(sim: number): string {
  return `${(sim * 100).toFixed(1)}%`;
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Search() {
  const { t } = useI18n();
  const [state, setState] = useState<SearchState>("idle");
  const [modelStatus, setModelStatus] = useState<ModelStatus>({ status: "idle", percent: 0, message: "", device: null, error: null });
  const [results, setResults] = useState<SearchResults | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [ocrEnabled, setOcrEnabled] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [copiedPath, setCopiedPath] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check OCR status on mount
  useEffect(() => {
    ocrService.getOcrStatus().then((s) => setOcrEnabled(s.enabled)).catch(() => {});
  }, []);

  const doSearch = useCallback(async (base64: string, displayUrl: string) => {
    setPreviewUrl(displayUrl);
    setState("loading-model");
    setErrorMsg("");
    setResults(null);
    setOcrText("");

    // Start model loading
    try {
      await aiService.loadModel();
    } catch {
      // Model may already be loaded or will load during search
    }

    // Poll model status
    const pollModel = () => {
      aiService.getModelStatus().then((s) => {
        setModelStatus(s);
        if (s.status === "error") {
          setState("error");
          setErrorMsg(s.error || s.message);
        }
      }).catch(() => {});
    };
    pollModel();
    pollRef.current = setInterval(pollModel, 500);

    setState("searching");

    try {
      const searchResults = await searchService.searchByImage(base64, 30);
      setResults(searchResults);
      setState("done");

      // Optional OCR
      if (ocrEnabled) {
        ocrService.recognize(base64).then((r) => {
          setOcrText(r.text);
        }).catch(() => {});
      }
    } catch (e) {
      setState("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    } finally {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
  }, [ocrEnabled]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg(t("aiSearch.invalidFileType"));
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

  const handleCopyPath = async (path: string) => {
    await copyToClipboard(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(""), 2000);
  };

  const handleOpenImage = (filePath: string) => {
    openFile(filePath);
  };

  const handleOpenExcel = (exId: string) => {
    // Navigate is not available directly; use display for now
    // The file_path from excel_info can be opened
  };

  const sourceTypeLabel = (type: string): string => {
    switch (type) {
      case "file_image": return t("aiSearch.sourceFileImage");
      case "excel_embedded": return t("aiSearch.sourceExcelEmbedded");
      default: return type;
    }
  };

  const isModelLoading = modelStatus.status === "loading";
  const showProgress = state === "loading-model" || state === "searching";
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
          <p className="search-dropzone-text">{t("aiSearch.dropHint")}</p>
          <p className="search-dropzone-sub">{t("aiSearch.dropSubHint")}</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleFileSelect}
        />
      </div>

      {/* Model loading progress */}
      {showProgress && (
        <div className="search-progress">
          {isModelLoading && (
            <div className="search-progress-bar-container">
              <div className="search-progress-bar" style={{ width: `${modelStatus.percent}%` }} />
            </div>
          )}
          <p className="search-progress-text">
            {isModelLoading
              ? `${t("aiSearch.loadingModel")} (${modelStatus.percent}%)`
              : t("aiSearch.searching")}
          </p>
          {modelStatus.device && (
            <p className="search-progress-device">{t("aiSearch.device")}: {modelStatus.device}</p>
          )}
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
              {t("aiSearch.foundResults", { count: String(results?.count ?? 0) })}
            </p>
            {results?.duration_ms !== undefined && (
              <p className="search-duration">{t("aiSearch.duration", { ms: String(results.duration_ms) })}</p>
            )}
          </div>
        </div>
      )}

      {/* OCR text */}
      {ocrText && (
        <div className="search-ocr-text">
          <span className="search-ocr-label">OCR:</span> {ocrText}
        </div>
      )}

      {/* Results */}
      {results && results.results.length > 0 && (
        <div className="search-results">
          <h3 className="search-results-title">{t("aiSearch.results")}</h3>
          <div className="search-results-list">
            {results.results.map((item: SearchResultItem) => (
              <div key={item.img_id} className="search-result-item">
                <div
                  className="search-result-thumb"
                  onClick={() => handleOpenImage(item.file_path)}
                  title={t("aiSearch.openImage")}
                >
                  <img
                    src={fileToUrl(item.file_path)}
                    alt={item.filename ?? item.img_id}
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
                <div className="search-result-info">
                  <div className="search-result-header">
                    <span className="search-result-id" title={item.img_id}>
                      {item.filename || item.img_id}
                    </span>
                    <span
                      className={`search-result-similarity ${item.similarity > 0.8 ? "high" : item.similarity > 0.5 ? "mid" : "low"}`}
                    >
                      {formatSimilarity(item.similarity)}
                    </span>
                  </div>
                  <div className="search-result-meta">
                    <span className="search-result-source">
                      {sourceTypeLabel(item.source_type)}
                    </span>
                    {item.width && item.height && (
                      <span className="search-result-dim">{item.width}x{item.height}</span>
                    )}
                    {item.size_bytes !== null && (
                      <span className="search-result-size">{formatFileSize(item.size_bytes)}</span>
                    )}
                  </div>
                  <div className="search-result-tags">
                    {item.tags.map((tag) => (
                      <span key={tag} className="search-result-tag">{tag}</span>
                    ))}
                  </div>
                  {/* Excel association */}
                  {item.excel_info && (
                    <div className="search-result-assoc">
                      <span className="assoc-label">EX:</span>
                      <span className="assoc-value">{item.excel_info.ex_id}</span>
                      <span className="assoc-detail">
                        {item.excel_info.sheet_name} / {item.excel_info.filename}
                      </span>
                      <button
                        className="assoc-open-btn"
                        onClick={() => openFile(item.excel_info!.file_path)}
                      >
                        {t("aiSearch.openExcel")}
                      </button>
                    </div>
                  )}
                  {/* CAD association */}
                  {item.cad_info && (
                    <div className="search-result-assoc">
                      <span className="assoc-label">CAD:</span>
                      <span className="assoc-value">{item.cad_info.cad_id}</span>
                      <span className="assoc-detail">{item.cad_info.filename}</span>
                      <button
                        className="assoc-open-btn"
                        onClick={() => openFile(item.cad_info!.file_path)}
                      >
                        {t("aiSearch.openCad")}
                      </button>
                    </div>
                  )}
                  {/* PDF association */}
                  {item.pdf_info && (
                    <div className="search-result-assoc">
                      <span className="assoc-label">PDF:</span>
                      <span className="assoc-value">{item.pdf_info.doc_id}</span>
                      <span className="assoc-detail">
                        {item.pdf_info.filename} ({item.pdf_info.page_count} {t("aiSearch.pages")})
                      </span>
                      <button
                        className="assoc-open-btn"
                        onClick={() => openFile(item.pdf_info!.file_path)}
                      >
                        {t("aiSearch.openPdf")}
                      </button>
                    </div>
                  )}
                </div>
                <div className="search-result-actions">
                  <button
                    className="search-action-btn"
                    onClick={() => handleOpenImage(item.file_path)}
                    title={t("aiSearch.openImage")}
                  >
                    {t("aiSearch.openImage")}
                  </button>
                  <button
                    className="search-action-btn"
                    onClick={() => handleCopyPath(item.file_path)}
                    title={t("aiSearch.copyPath")}
                  >
                    {copiedPath === item.file_path ? t("aiSearch.copied") : t("aiSearch.copyPath")}
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
          <p className="search-empty-icon">🔍</p>
          <p className="search-empty-title">{t("aiSearch.noResults")}</p>
          <p className="search-empty-desc">{t("aiSearch.noResultsDesc")}</p>
        </div>
      )}
    </div>
  );
}
