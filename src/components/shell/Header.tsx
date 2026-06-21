import { useSetAtom } from "jotai";
import { WindowControls } from "./WindowControls";
import { ThemeToggle } from "../shared/ThemeToggle";
import { LocaleToggle } from "../shared/LocaleToggle";
import { useI18n } from "../../i18n/context";
import { globalSearchOpenAtom } from "../../stores/atoms";

export function Header() {
  const { t } = useI18n();
  const setGlobalSearchOpen = useSetAtom(globalSearchOpenAtom);

  return (
    <header className="header" data-tauri-drag-region>
      <div
        className="header-search"
        onClick={() => setGlobalSearchOpen(true)}
        style={{ cursor: "pointer" }}
      >
        <svg
          className="header-search-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="header-search-input"
          placeholder={t("globalSearch.placeholder")}
          readOnly
          style={{ cursor: "pointer" }}
          aria-label={t("globalSearch.placeholder")}
        />
      </div>
      <div className="header-actions">
        <div className="header-actions-left">
          <LocaleToggle />
          <ThemeToggle />
        </div>
        <WindowControls />
      </div>
    </header>
  );
}
