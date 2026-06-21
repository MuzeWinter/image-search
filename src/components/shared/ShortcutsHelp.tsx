import { useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { shortcutsHelpOpenAtom } from "../../stores/atoms";
import { useI18n } from "../../i18n/context";

interface ShortcutEntry {
  keys: string;
  labelKey: string;
}

export default function ShortcutsHelp() {
  const { t } = useI18n();
  const [open, setOpen] = useAtom(shortcutsHelpOpenAtom);

  const handleClose = useCallback(() => setOpen(false), [setOpen]);

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

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, setOpen]);

  if (!open) return null;

  const shortcuts: ShortcutEntry[] = [
    { keys: "Ctrl+1", labelKey: "shortcuts.navSearch" },
    { keys: "Ctrl+2", labelKey: "shortcuts.navLibrary" },
    { keys: "Ctrl+3", labelKey: "shortcuts.navSettings" },
    { keys: "Ctrl+V", labelKey: "shortcuts.pasteSearch" },
    { keys: "Ctrl+Shift+F", labelKey: "shortcuts.globalSearch" },
    { keys: "Ctrl+/", labelKey: "shortcuts.toggleHelp" },
    { keys: "Escape", labelKey: "shortcuts.escapeCancel" },
  ];

  return (
    <div
      className="shortcuts-help-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="shortcuts-help-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-help-header">
          <h2 className="shortcuts-help-title">{t("shortcuts.title")}</h2>
          <button
            className="shortcuts-help-close"
            onClick={handleClose}
            aria-label={t("common.close")}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="shortcuts-help-list">
          {shortcuts.map((sc) => (
            <div key={sc.keys} className="shortcuts-help-item">
              <kbd className="shortcuts-help-keys">{sc.keys}</kbd>
              <span className="shortcuts-help-label">{t(sc.labelKey)}</span>
            </div>
          ))}
        </div>

        <div className="shortcuts-help-footer">
          {t("shortcuts.footerHint")}
        </div>
      </div>
    </div>
  );
}
