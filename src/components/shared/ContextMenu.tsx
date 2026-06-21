import { useRef, useEffect, useLayoutEffect } from "react";

export interface ContextMenuItem {
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  separator?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const adjustedRef = useRef(false);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el || adjustedRef.current) return;

    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let ax = x;
    let ay = y;

    if (x + rect.width > vw) ax = Math.max(8, vw - rect.width - 8);
    if (y + rect.height > vh) ay = Math.max(8, vh - rect.height - 8);

    if (ax !== x || ay !== y) {
      el.style.left = `${ax}px`;
      el.style.top = `${ay}px`;
    }
    adjustedRef.current = true;
  }, [x, y]);

  useEffect(() => {
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleDown);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleDown);
    };
  }, [onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    const handleScroll = () => onClose();
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
      role="menu"
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="context-menu-separator" role="separator" />
        ) : (
          <button
            key={i}
            className={`context-menu-item ${item.disabled ? "disabled" : ""}`}
            onClick={() => {
              if (!item.disabled) {
                item.onClick?.();
                onClose();
              }
            }}
            disabled={item.disabled}
            role="menuitem"
            aria-label={item.label}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
