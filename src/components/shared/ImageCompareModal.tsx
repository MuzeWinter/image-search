import { useState, useRef, useCallback, useEffect } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { useI18n } from "../../i18n/context";
import type { SearchResultItem } from "../../services/searchService";

interface ImageCompareModalProps {
  open: boolean;
  itemA: SearchResultItem;
  itemB: SearchResultItem;
  onClose: () => void;
}

export default function ImageCompareModal({
  open,
  itemA,
  itemB,
  onClose,
}: ImageCompareModalProps) {
  const { t } = useI18n();
  const bodyRef = useRef<HTMLDivElement>(null);
  const containerARef = useRef<HTMLDivElement>(null);
  const containerBRef = useRef<HTMLDivElement>(null);
  const imgARef = useRef<HTMLImageElement>(null);
  const imgBRef = useRef<HTMLImageElement>(null);

  const [dividerPct, setDividerPct] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [panA, setPanA] = useState({ x: 0, y: 0 });
  const [panB, setPanB] = useState({ x: 0, y: 0 });
  const [imgAErr, setImgAErr] = useState(false);
  const [imgBErr, setImgBErr] = useState(false);

  const dragRef = useRef<{
    type: "divider" | "imageA" | "imageB";
    startX: number;
    startY: number;
    startDividerPct: number;
    startPanX: number;
    startPanY: number;
  } | null>(null);

  const fitScaleRef = useRef(1);

  const urlA = itemA.image_path?.trim() ? convertFileSrc(itemA.image_path) : null;
  const urlB = itemB.image_path?.trim() ? convertFileSrc(itemB.image_path) : null;

  const computeFitScale = useCallback(() => {
    const panelA = containerARef.current;
    const panelB = containerBRef.current;
    const imgA = imgARef.current;
    const imgB = imgBRef.current;
    if (!panelA || !panelB) return;

    const pwA = panelA.clientWidth;
    const phA = panelA.clientHeight;
    const pwB = panelB.clientWidth;
    const phB = panelB.clientHeight;

    let fitA = 1;
    let fitB = 1;

    if (imgA && imgA.naturalWidth && imgA.naturalHeight) {
      fitA = Math.min(pwA / imgA.naturalWidth, phA / imgA.naturalHeight);
    }
    if (imgB && imgB.naturalWidth && imgB.naturalHeight) {
      fitB = Math.min(pwB / imgB.naturalWidth, phB / imgB.naturalHeight);
    }

    fitScaleRef.current = Math.min(fitA, fitB);
  }, []);

  const resetView = useCallback(() => {
    computeFitScale();
    setZoom(1);
    setPanA({ x: 0, y: 0 });
    setPanB({ x: 0, y: 0 });
  }, [computeFitScale]);

  // Reset view when modal opens or images change
  useEffect(() => {
    if (open) {
      setDividerPct(50);
      setZoom(1);
      setPanA({ x: 0, y: 0 });
      setPanB({ x: 0, y: 0 });
      setImgAErr(false);
      setImgBErr(false);
      fitScaleRef.current = 1;
      // Compute fit after layout
      requestAnimationFrame(() => computeFitScale());
    }
  }, [open, itemA.img_id, itemB.img_id, computeFitScale]);

  // Lock body scroll when open
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

  // Mouse move / up handlers for divider and image drag
  useEffect(() => {
    if (!open) return;

    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      if (drag.type === "divider") {
        const body = bodyRef.current;
        if (!body) return;
        const rect = body.getBoundingClientRect();
        const dx = e.clientX - drag.startX;
        const newPct = drag.startDividerPct + (dx / rect.width) * 100;
        setDividerPct(Math.max(10, Math.min(90, newPct)));
      } else if (drag.type === "imageA" || drag.type === "imageB") {
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        const pan = {
          x: drag.startPanX + dx,
          y: drag.startPanY + dy,
        };
        if (drag.type === "imageA") {
          setPanA(pan);
        } else {
          setPanB(pan);
        }
      }
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
  }, [open]);

  // Wheel zoom (synchronized)
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoom((z) => {
        const next = z + delta;
        return Math.max(0.1, Math.min(10, next));
      });
    },
    [],
  );

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(10, z + 0.25));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(0.1, z - 0.25));
  }, []);

  const handleFit = useCallback(() => {
    resetView();
  }, [resetView]);

  const handleReset = useCallback(() => {
    computeFitScale();
    setZoom(fitScaleRef.current > 0 ? 1 / fitScaleRef.current : 1);
    setPanA({ x: 0, y: 0 });
    setPanB({ x: 0, y: 0 });
  }, [computeFitScale]);

  const startDragDivider = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        type: "divider",
        startX: e.clientX,
        startY: e.clientY,
        startDividerPct: dividerPct,
        startPanX: 0,
        startPanY: 0,
      };
    },
    [dividerPct],
  );

  const startDragImage = useCallback(
    (side: "A" | "B") => (e: React.MouseEvent) => {
      e.preventDefault();
      const pan = side === "A" ? panA : panB;
      dragRef.current = {
        type: side === "A" ? "imageA" : "imageB",
        startX: e.clientX,
        startY: e.clientY,
        startDividerPct: 0,
        startPanX: pan.x,
        startPanY: pan.y,
      };
    },
    [panA, panB],
  );

  // Recompute fit on window resize
  useEffect(() => {
    if (!open) return;
    const onResize = () => computeFitScale();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, computeFitScale]);

  if (!open) return null;

  const effectiveScale = zoom * fitScaleRef.current;
  const zoomPct = Math.round(effectiveScale * 100);

  return (
    <div className="image-compare-overlay" onClick={onClose}>
      {/* Header */}
      <div className="image-compare-header" onClick={(e) => e.stopPropagation()}>
        <span className="image-compare-title">{t("search.compareTitle")}</span>
        <div className="image-compare-zoom-group">
          <button className="image-compare-zoom-btn" onClick={handleZoomOut} title={t("search.compareZoomOut")} aria-label={t("search.compareZoomOut")}>
            -
          </button>
          <span className="image-compare-zoom-label">{zoomPct}%</span>
          <button className="image-compare-zoom-btn" onClick={handleZoomIn} title={t("search.compareZoomIn")} aria-label={t("search.compareZoomIn")}>
            +
          </button>
          <button className="image-compare-zoom-btn" onClick={handleFit} title={t("search.compareZoomFit")} aria-label={t("search.compareZoomFit")}>
            {t("search.compareZoomFit")}
          </button>
          <button className="image-compare-zoom-btn" onClick={handleReset} title={t("search.compareZoomReset")} aria-label={t("search.compareZoomReset")}>
            {t("search.compareZoomReset")}
          </button>
        </div>
        <button className="image-compare-close" onClick={onClose} aria-label={t("search.compareClose")}>
          {t("search.compareClose")}
        </button>
      </div>

      {/* Body */}
      <div
        className="image-compare-body"
        ref={bodyRef}
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
      >
        {/* Left panel */}
        <div
          className="image-compare-panel"
          ref={containerARef}
          style={{ flex: `0 0 ${dividerPct}%` }}
          onMouseDown={startDragImage("A")}
        >
          <span className="image-compare-panel-label">{itemA.img_id}</span>
          {imgAErr ? (
            <div className="image-compare-panel-error">{t("search.noPreview")}</div>
          ) : urlA ? (
            <img
              ref={imgARef}
              src={urlA}
              alt={itemA.img_id}
              draggable={false}
              onLoad={() => computeFitScale()}
              onError={() => setImgAErr(true)}
              style={{
                transform: `translate(${panA.x}px, ${panA.y}px) scale(${effectiveScale})`,
              }}
            />
          ) : (
            <div className="image-compare-panel-error">{t("search.noPreview")}</div>
          )}
        </div>

        {/* Divider */}
        <div
          className={`image-compare-divider${dragRef.current?.type === "divider" ? " dragging" : ""}`}
          onMouseDown={startDragDivider}
        />

        {/* Right panel */}
        <div
          className="image-compare-panel"
          ref={containerBRef}
          style={{ flex: `0 0 ${100 - dividerPct}%` }}
          onMouseDown={startDragImage("B")}
        >
          <span className="image-compare-panel-label">{itemB.img_id}</span>
          {imgBErr ? (
            <div className="image-compare-panel-error">{t("search.noPreview")}</div>
          ) : urlB ? (
            <img
              ref={imgBRef}
              src={urlB}
              alt={itemB.img_id}
              draggable={false}
              onLoad={() => computeFitScale()}
              onError={() => setImgBErr(true)}
              style={{
                transform: `translate(${panB.x}px, ${panB.y}px) scale(${effectiveScale})`,
              }}
            />
          ) : (
            <div className="image-compare-panel-error">{t("search.noPreview")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
