import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useI18n } from "../../i18n/context";

export function WindowControls() {
  const { t } = useI18n();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    let mounted = true;
    const win = getCurrentWindow();

    win.isMaximized().then((v) => {
      if (mounted) setIsMaximized(v);
    });

    const unlistenPromise = win.onResized(async () => {
      const v = await win.isMaximized();
      if (mounted) setIsMaximized(v);
    });

    return () => {
      mounted = false;
      unlistenPromise.then((fn) => fn());
    };
  }, []);

  function minimize() {
    getCurrentWindow().minimize();
  }

  function toggleMaximize() {
    getCurrentWindow().toggleMaximize();
  }

  function close() {
    getCurrentWindow().close();
  }

  return (
    <div className="window-controls">
      <button
        className="wc-btn wc-minimize"
        onClick={minimize}
        title={t("window.minimize")}
        aria-label={t("window.minimize")}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <rect x="1" y="5.5" width="10" height="1" fill="currentColor" />
        </svg>
      </button>
      <button
        className="wc-btn wc-maximize"
        onClick={toggleMaximize}
        title={isMaximized ? t("window.restore") : t("window.maximize")}
        aria-label={isMaximized ? t("window.restore") : t("window.maximize")}
      >
        {isMaximized ? (
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="2.5" y="1" width="7" height="7" rx="0.5" fill="none" stroke="currentColor" strokeWidth="1" />
            <rect x="1" y="3.5" width="7" height="7" rx="0.5" fill="var(--surface)" stroke="currentColor" strokeWidth="1" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect x="1.5" y="1.5" width="9" height="9" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        )}
      </button>
      <button
        className="wc-btn wc-close"
        onClick={close}
        title={t("window.close")}
        aria-label={t("window.close")}
      >
        <svg width="12" height="12" viewBox="0 0 12 12">
          <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.2" />
          <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
    </div>
  );
}
