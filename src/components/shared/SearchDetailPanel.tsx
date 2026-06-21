import { useState, useRef, useCallback, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../../i18n/context";
import { useToast } from "../../contexts/ToastContext";
import type { SearchResultItem } from "../../services/searchService";
import * as exportService from "../../services/exportService";
import { openFile, openFolder } from "../../services/systemService";

interface SearchDetailPanelProps {
  open: boolean;
  item: SearchResultItem | null;
  onClose: () => void;
}

export default function SearchDetailPanel({
  open,
  item,
  onClose,
}: SearchDetailPanelProps) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const [zoom, setZoom] = useState(1);
  const [imgErr, setImgErr] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fitScaleRef = useRef(1);

  // Pan state
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const url = item?.image_path?.trim() ? convertFileSrc(item.image_path) : null;

  const computeFitScale = useCallback(() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img || !img.naturalWidth || !img.naturalHeight) return;

    const pw = container.clientWidth;
    const ph = container.clientHeight;
    fitScaleRef.current = Math.min(
      Math.max(0.1, pw / img.naturalWidth),
      Math.max(0.1, ph / img.naturalHeight),
    );
  }, []);

  const resetView = useCallback(() => {
    computeFitScale();
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [computeFitScale]);

  // Reset when item changes
  useEffect(() => {
    if (open && item) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setImgErr(false);
      fitScaleRef.current = 1;
      requestAnimationFrame(() => computeFitScale());
    }
  }, [open, item, computeFitScale]);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.1, Math.min(10, z + delta)));
  }, []);

  // Pan drag
  const startDrag = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startPanX: pan.x,
        startPanY: pan.y,
      };
    },
    [pan],
  );

  useEffect(() => {
    if (!open) return;

    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      setPan({
        x: drag.startPanX + (e.clientX - drag.startX),
        y: drag.startPanY + (e.clientY - drag.startY),
      });
    };

    const onUp = () => {
      dragRef.current = null;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [open, pan]);

  // Recompute fit on resize
  useEffect(() => {
    if (!open) return;
    const onResize = () => computeFitScale();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, computeFitScale]);

  // Actions
  const handleCopyPath = useCallback(async () => {
    if (!item) return;
    await navigator.clipboard.writeText(item.image_path);
    addToast("success", t("search.copied"));
  }, [item, t, addToast]);

  const handleOpenFolder = useCallback(() => {
    if (!item) return;
    openFolder(item.image_path);
  }, [item]);

  const handleOpenFile = useCallback(() => {
    if (!item) return;
    openFile(item.image_path);
  }, [item]);

  const handleCopyImage = useCallback(async () => {
    if (!item) return;
    try {
      await exportService.copyImageToClipboard(item.image_path);
      addToast("success", t("search.imageCopied"));
    } catch (e) {
      addToast("error", t("search.imageCopyFailed", { error: String(e instanceof Error ? e.message : e) }));
    }
  }, [item, t, addToast]);

  const handleExportZip = useCallback(async () => {
    if (!item) return;

    const filePath = await save({
      defaultPath: `${item.img_id}.zip`,
      filters: [{ name: "ZIP Archive", extensions: ["zip"] }],
    });
    if (!filePath) return;

    setExporting(true);
    try {
      const exportItem = {
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
      };
      await exportService.exportZip(filePath, [exportItem]);
      addToast("success", t("search.exportZipSuccess"));
    } catch (e) {
      addToast("error", t("search.exportZipFailed", { error: String(e instanceof Error ? e.message : e) }));
    } finally {
      setExporting(false);
    }
  }, [item, t, addToast]);

  if (!open || !item) return null;

  const effectiveScale = zoom * fitScaleRef.current;
  const zoomPct = Math.round(effectiveScale * 100);
  const simClass =
    item.similarity > 0.8 ? "high" : item.similarity > 0.5 ? "mid" : "low";

  const sourceTypeLabel =
    item.source_type === "excel-embedded"
      ? t("search.sourceExcelEmbedded")
      : item.source_type === "ug-preview"
        ? t("search.sourceUgPreview")
        : item.source_type;

  return (
    <div className="search-detail-overlay" onClick={onClose}>
      <div className="search-detail-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="search-detail-header">
          <span className="search-detail-title">{t("search.detailTitle")}</span>
          <button className="search-detail-close" onClick={onClose} aria-label={t("common.close")}>
            x
          </button>
        </div>

        {/* Body */}
        <div className="search-detail-body">
          {/* Image preview */}
          <div className="search-detail-preview">
            <div
              className="search-detail-preview-container"
              ref={containerRef}
              onWheel={handleWheel}
              onMouseDown={startDrag}
            >
              {imgErr ? (
                <div className="search-detail-preview-error">
                  {t("search.detailNoImage")}
                </div>
              ) : url ? (
                <img
                  ref={imgRef}
                  src={url}
                  alt={item.img_id}
                  draggable={false}
                  className="search-detail-preview-img"
                  onLoad={() => computeFitScale()}
                  onError={() => setImgErr(true)}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${effectiveScale})`,
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }}
                />
              ) : (
                <div className="search-detail-preview-error">
                  {t("search.detailNoImage")}
                </div>
              )}
            </div>
            <div className="search-detail-zoom-bar">
              <button
                className="search-detail-zoom-btn"
                onClick={() => setZoom((z) => Math.max(0.1, z - 0.25))}
                title={t("search.compareZoomOut")}
                aria-label={t("search.compareZoomOut")}
              >
                -
              </button>
              <span className="search-detail-zoom-label">{zoomPct}%</span>
              <button
                className="search-detail-zoom-btn"
                onClick={() => setZoom((z) => Math.min(10, z + 0.25))}
                title={t("search.compareZoomIn")}
                aria-label={t("search.compareZoomIn")}
              >
                +
              </button>
              <button
                className="search-detail-zoom-btn"
                onClick={resetView}
                title={t("search.compareZoomFit")}
                aria-label={t("search.compareZoomFit")}
              >
                {t("search.compareZoomFit")}
              </button>
              <button
                className="search-detail-zoom-btn"
                onClick={() => {
                  computeFitScale();
                  setZoom(fitScaleRef.current > 0 ? 1 / fitScaleRef.current : 1);
                  setPan({ x: 0, y: 0 });
                }}
                title={t("search.compareZoomReset")}
                aria-label={t("search.compareZoomReset")}
              >
                {t("search.compareZoomReset")}
              </button>
            </div>
          </div>

          {/* Basic info */}
          <div className="search-detail-section">
            <div className="search-detail-section-title">
              {t("search.detailTitle")}
            </div>
            <div className="search-detail-info-grid">
              <div className="search-detail-info-row">
                <span className="search-detail-info-label">
                  {t("search.detailFileName")}
                </span>
                <span className="search-detail-info-value">
                  {item.image_path.replace(/\\/g, "/").split("/").pop() || item.img_id}
                </span>
              </div>
              <div className="search-detail-info-row">
                <span className="search-detail-info-label">
                  {t("search.detailFilePath")}
                </span>
                <span className="search-detail-info-value path" title={item.image_path}>
                  {item.image_path}
                </span>
              </div>
              {(item.width != null || item.height != null) && (
                <div className="search-detail-info-row">
                  <span className="search-detail-info-label">
                    {t("search.detailDimensions")}
                  </span>
                  <span className="search-detail-info-value mono">
                    {item.width != null && item.height != null
                      ? `${item.width} x ${item.height}`
                      : "—"}
                  </span>
                </div>
              )}
              {item.format && (
                <div className="search-detail-info-row">
                  <span className="search-detail-info-label">
                    {t("search.detailFormat")}
                  </span>
                  <span className="search-detail-info-value mono">
                    {item.format.toUpperCase()}
                  </span>
                </div>
              )}
              {item.size_bytes != null && (
                <div className="search-detail-info-row">
                  <span className="search-detail-info-label">
                    {t("search.detailSize")}
                  </span>
                  <span className="search-detail-info-value mono">
                    {item.size_bytes < 1024
                      ? `${item.size_bytes} B`
                      : item.size_bytes < 1024 * 1024
                        ? `${(item.size_bytes / 1024).toFixed(0)} KB`
                        : item.size_bytes < 1024 * 1024 * 1024
                          ? `${(item.size_bytes / (1024 * 1024)).toFixed(1)} MB`
                          : `${(item.size_bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`}
                  </span>
                </div>
              )}
              <div className="search-detail-info-row">
                <span className="search-detail-info-label">
                  {t("search.detailSimilarity")}
                </span>
                <span>
                  <span className={`search-detail-sim-badge ${simClass}`}>
                    {(item.similarity * 100).toFixed(1)}%
                  </span>
                </span>
              </div>
              <div className="search-detail-info-row">
                <span className="search-detail-info-label">
                  {t("search.detailSourceType")}
                </span>
                <span>
                  <span className={`search-detail-source-badge ${item.source_type}`}>
                    {sourceTypeLabel}
                  </span>
                </span>
              </div>
              {item.origin_path && item.origin_path !== item.image_path && (
                <div className="search-detail-info-row">
                  <span className="search-detail-info-label">
                    {t("search.detailFilePath")}
                  </span>
                  <span className="search-detail-info-value path" title={item.origin_path}>
                    {item.origin_path}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Related info */}
          {(item.ug_ref || item.sheet_name || item.ocr_text) && (
            <div className="search-detail-section">
              <div className="search-detail-section-title">
                {t("search.detailTitle")}
              </div>
              <div className="search-detail-related">
                {item.ug_ref && (
                  <div className="search-detail-related-item">
                    <span className="search-detail-related-label">UG:</span>
                    <span className="search-detail-related-value">
                      {item.ug_ref}
                    </span>
                  </div>
                )}
                {item.source_type === "excel-embedded" && item.sheet_name && (
                  <div className="search-detail-related-item">
                    <span className="search-detail-related-label">
                      {t("search.sheet")}:
                    </span>
                    <span className="search-detail-related-value">
                      {item.sheet_name}
                      {item.row_number != null && ` / R${item.row_number}`}
                    </span>
                  </div>
                )}
                {item.ocr_text && (
                  <div className="search-detail-related-item">
                    <span className="search-detail-related-label">
                      {t("search.ocrLabel")}:
                    </span>
                    <span className="search-detail-related-value">
                      {item.ocr_text}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="search-detail-section">
            <div className="search-detail-section-title">
              {t("search.detailActions")}
            </div>
            <div className="search-detail-actions">
              <button className="search-detail-action-btn" onClick={handleCopyPath} aria-label={t("search.copyPath")}>
                {t("search.copyPath")}
              </button>
              <button className="search-detail-action-btn" onClick={handleOpenFolder} aria-label={t("search.openFolder")}>
                {t("search.openFolder")}
              </button>
              <button className="search-detail-action-btn" onClick={handleOpenFile} aria-label={t("search.detailOpenFile")}>
                {t("search.detailOpenFile")}
              </button>
              <button className="search-detail-action-btn" onClick={handleCopyImage} aria-label={t("search.copyImageToClipboard")}>
                {t("search.copyImageToClipboard")}
              </button>
              <button
                className="search-detail-action-btn primary"
                onClick={handleExportZip}
                disabled={exporting}
                aria-label={t("search.detailExportZip")}
              >
                {exporting ? t("search.exporting") : t("search.detailExportZip")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
