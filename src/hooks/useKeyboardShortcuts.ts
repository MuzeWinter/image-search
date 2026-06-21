import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { escapeEpochAtom } from "../stores/atoms";

export function useKeyboardShortcuts() {
  const navigate = useNavigate();
  const fireEscape = useSetAtom(escapeEpochAtom);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();

      // Don't trigger shortcuts when focus is in an input field
      if (tagName === "input" || tagName === "textarea" || tagName === "select") {
        return;
      }
      if (target.isContentEditable) {
        return;
      }

      const ctrl = e.ctrlKey || e.metaKey;

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
  }, [navigate, fireEscape]);
}
