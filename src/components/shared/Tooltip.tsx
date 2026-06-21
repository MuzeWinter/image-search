import { useState, useRef, useCallback, useEffect, cloneElement, type ReactElement, type MouseEvent as ReactMouseEvent, type FocusEvent as ReactFocusEvent } from "react";
import { createPortal } from "react-dom";

type Position = "top" | "bottom";

interface TooltipProps {
  content: string;
  children: ReactElement;
  position?: Position;
  delay?: number;
}

type Handler = ((e: ReactMouseEvent) => void) | undefined;
type FocusHandler = ((e: ReactFocusEvent) => void) | undefined;

const TOOLTIP_GAP = 6;

function computeCoords(
  triggerRect: DOMRect,
  preferred: Position,
): { x: number; y: number; pos: Position } {
  const ttWidth = 200;
  const ttHeight = 28;

  const viewportW = window.innerWidth;
  const viewportH = window.innerHeight;

  const candidates: Position[] = [preferred, preferred === "top" ? "bottom" : "top"];

  for (const pos of candidates) {
    let x: number;
    let y: number;

    if (pos === "top") {
      x = triggerRect.left + triggerRect.width / 2;
      y = triggerRect.top - TOOLTIP_GAP;
    } else {
      x = triggerRect.left + triggerRect.width / 2;
      y = triggerRect.bottom + TOOLTIP_GAP;
    }

    const halfW = ttWidth / 2;
    const clampedX = Math.max(8 + halfW, Math.min(viewportW - 8 - halfW, x));

    const fitsY =
      pos === "top"
        ? y - ttHeight >= 8
        : y + ttHeight <= viewportH - 8;

    if (fitsY) {
      return { x: clampedX, y, pos };
    }
  }

  if (preferred === "top") {
    return {
      x: Math.max(8 + ttWidth / 2, Math.min(viewportW - 8 - ttWidth / 2, triggerRect.left + triggerRect.width / 2)),
      y: Math.max(8 + ttHeight, triggerRect.top - TOOLTIP_GAP),
      pos: "top",
    };
  }
  return {
    x: Math.max(8 + ttWidth / 2, Math.min(viewportW - 8 - ttWidth / 2, triggerRect.left + triggerRect.width / 2)),
    y: Math.min(viewportH - 8 - ttHeight, triggerRect.bottom + TOOLTIP_GAP),
    pos: "bottom",
  };
}

export function Tooltip({ content, children, position = "top", delay = 300 }: TooltipProps) {
  const [state, setState] = useState<{ x: number; y: number; pos: Position } | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visible = state !== null;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect();
        setState(computeCoords(rect, position));
      }
    }, delay);
  }, [delay, position, clearTimer]);

  const hide = useCallback(() => {
    clearTimer();
    setState(null);
  }, [clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const childProps = children.props as Record<string, unknown>;
  const origMouseEnter = childProps.onMouseEnter as Handler;
  const origMouseLeave = childProps.onMouseLeave as Handler;
  const origFocus = childProps.onFocus as FocusHandler;
  const origBlur = childProps.onBlur as FocusHandler;

  const child = cloneElement(children, {
    onMouseEnter: (e: ReactMouseEvent) => {
      show();
      origMouseEnter?.(e);
    },
    onMouseLeave: (e: ReactMouseEvent) => {
      hide();
      origMouseLeave?.(e);
    },
    onFocus: (e: ReactFocusEvent) => {
      show();
      origFocus?.(e);
    },
    onBlur: (e: ReactFocusEvent) => {
      hide();
      origBlur?.(e);
    },
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node;
      const childRef = (children as unknown as { ref?: unknown }).ref;
      if (typeof childRef === "function") {
        (childRef as (node: HTMLElement | null) => void)(node);
      } else if (childRef && typeof childRef === "object" && "current" in childRef) {
        (childRef as { current: HTMLElement | null }).current = node;
      }
    },
  });

  return (
    <>
      {child}
      {visible &&
        createPortal(
          <div
            className={`tooltip tooltip-${state.pos}`}
            style={{ left: state.x, top: state.y }}
            role="tooltip"
          >
            <span className="tooltip-inner">{content}</span>
          </div>,
          document.body,
        )}
    </>
  );
}
