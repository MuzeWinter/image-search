import { useState, useRef, useEffect, useCallback } from "react";
import { useAtom } from "jotai";
import { convertFileSrc } from "@tauri-apps/api/core";
import { globalSearchOpenAtom } from "../../stores/atoms";
import { useI18n } from "../../i18n/context";
import { query } from "../../services/dbService";
import { openFile, openFolder } from "../../services/systemService";

interface SearchResult {
  img_id: string;
  filename: string;
  ug_ref: string | null;
  file_path: string;
  image_path: string | null;
  source_type: string;
  folder: string;
}

export default function GlobalSearch() {
  const { t } = useI18n();
  const [open, setOpen] = useAtom(globalSearchOpenAtom);
  const [query_, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setSelectedIdx(0);
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

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

  // Search handler with debounce
  const doSearch = useCallback(
    (searchTerm: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!searchTerm.trim()) {
        setResults([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      debounceRef.current = setTimeout(async () => {
        try {
          const pattern = `%${searchTerm}%`;
          const rows = await query<SearchResult>(
            `SELECT img_id, filename, ug_ref, file_path, image_path, source_type, folder
             FROM images
             WHERE filename LIKE ? OR ug_ref LIKE ?
             ORDER BY filename
             LIMIT 50`,
            [pattern, pattern],
          );
          setResults(rows);
          setSelectedIdx(0);
        } catch {
          setResults([]);
        } finally {
          setLoading(false);
        }
      }, 150);
    },
    [],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      doSearch(val);
    },
    [doSearch],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = results[selectedIdx];
        if (item) {
          const path = item.image_path || item.file_path;
          if (path) {
            openFile(path);
            setOpen(false);
          }
        }
      }
    },
    [results, selectedIdx, setOpen],
  );

  // Scroll selected into view
  useEffect(() => {
    if (resultsRef.current) {
      const selected = resultsRef.current.querySelector(
        `[data-index="${selectedIdx}"]`,
      );
      if (selected) {
        selected.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedIdx]);

  const handleClose = useCallback(() => setOpen(false), [setOpen]);

  if (!open) return null;

  return (
    <div
      className="global-search-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="global-search-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="global-search-input-wrap">
          <svg
            className="global-search-input-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="global-search-input"
            placeholder={t("globalSearch.placeholder")}
            value={query_}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
          />
          <span className="global-search-shortcut">
            {t("globalSearch.shortcutHint")}
          </span>
        </div>

        <div className="global-search-results" ref={resultsRef}>
          {loading && (
            <div className="global-search-status">
              {t("globalSearch.searching")}
            </div>
          )}
          {!loading && query_.trim() && results.length === 0 && (
            <div className="global-search-status">
              <div>{t("globalSearch.noResults")}</div>
              <div className="global-search-status-desc">
                {t("globalSearch.noResultsDesc")}
              </div>
            </div>
          )}
          {!loading &&
            results.map((item, idx) => (
              <div
                key={item.img_id}
                className="global-search-item"
                data-index={idx}
                style={{
                  background:
                    idx === selectedIdx
                      ? "var(--hover)"
                      : undefined,
                }}
                onClick={() => {
                  const path = item.image_path || item.file_path;
                  if (path) {
                    openFile(path);
                    setOpen(false);
                  }
                }}
                onMouseEnter={() => setSelectedIdx(idx)}
              >
                {item.image_path ? (
                  <img
                    className="global-search-item-thumb"
                    src={convertFileSrc(item.image_path)}
                    alt={item.filename}
                    loading="lazy"
                  />
                ) : (
                  <div className="global-search-item-thumb-placeholder">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21,15 16,10 5,21" />
                    </svg>
                  </div>
                )}
                <div className="global-search-item-info">
                  <div className="global-search-item-name">
                    {item.filename}
                  </div>
                  <div className="global-search-item-meta">
                    {item.ug_ref && <span>{item.ug_ref}</span>}
                    <span>{item.source_type}</span>
                  </div>
                </div>
                <div className="global-search-item-actions">
                  <button
                    className="global-search-item-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      const path = item.image_path || item.file_path;
                      if (path) openFile(path);
                    }}
                    title={t("globalSearch.openFile")}
                  >
                    {t("globalSearch.openFile")}
                  </button>
                  <button
                    className="global-search-item-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      openFolder(item.folder);
                    }}
                    title={t("globalSearch.openFolder")}
                  >
                    {t("globalSearch.openFolder")}
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
