import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { escapeEpochAtom, globalSearchOpenAtom, shortcutsHelpOpenAtom } from "../stores/atoms";

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const fireEscape = useSetAtom(escapeEpochAtom);
  const setGlobalSearchOpen = useSetAtom(globalSearchOpenAtom);
  const setShortcutsHelpOpen = useSetAtom(shortcutsHelpOpenAtom);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+Shift+F: global search — works everywhere, even in inputs
      if (ctrl && e.shiftKey && (e.key === "F" || e.key === "f")) {
        e.preventDefault();
        setGlobalSearchOpen(true);
        return;
      }

      // Ctrl+/: toggle shortcuts help — works everywhere, even in inputs
      if (ctrl && (e.key === "/" || e.code === "Slash")) {
        e.preventDefault();
        setShortcutsHelpOpen((prev) => !prev);
        return;
      }

      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();

      const isInput =
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        target.isContentEditable;

      // ? key — open shortcuts help (only outside inputs)
      if (e.key === "?" && !ctrl && !e.metaKey && !e.altKey && !isInput) {
        e.preventDefault();
        setShortcutsHelpOpen((prev) => !prev);
        return;
      }

      // Don't trigger remaining shortcuts when focus is in an input field
      if (isInput) {
        return;
      }

      if (ctrl && e.key === "1") {
        e.preventDefault();
        navigate("/");
      } else if (ctrl && e.key === "2") {
        e.preventDefault();
        navigate("/library");
      } else if (ctrl && e.key === "3") {
        e.preventDefault();
        navigate("/settings");
      } else if (e.key === "Escape") {
        e.preventDefault();
        fireEscape(Date.now());
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [navigate, fireEscape, setGlobalSearchOpen, setShortcutsHelpOpen]);
}
