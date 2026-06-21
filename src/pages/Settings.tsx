import { useState, useEffect } from "react";
import { useI18n, type Locale } from "../i18n/context";
import { useToast } from "../contexts/ToastContext";
import { useTheme, type Theme } from "../contexts/ThemeContext";
import * as settingsService from "../services/settingsService";
import { getDbStats, optimizeDb } from "../services/settingsService";
import { getLogs, type ActivityLog } from "../services/dbService";
import { callBackend } from "../services/ipc";
import { open as openDialog, save } from "@tauri-apps/plugin-dialog";
import { open } from "@tauri-apps/plugin-shell";

const UG_COLUMN_KEY = "ugColumnName";

type DiagStatus = "ok" | "warn" | "error";

interface DiagCheck {
  name: string;
  status: DiagStatus;
  detail: string;
  suggestion?: string;
}

interface DiagResult {
  ok: boolean;
  checks: DiagCheck[];
  summary: { total: number; passed: number; failed: number; warning: number };
}

function getSavedUgColumn(): string {
  try {
    const saved = localStorage.getItem(UG_COLUMN_KEY);
    if (saved) return saved;
  } catch { /* localStorage unavailable */ }
  return "图号";
}

export default function Settings() {
  const { t, locale, setLocale } = useI18n();
  const { addToast } = useToast();
  const { theme, setTheme } = useTheme();
  const [ugColumnName, setUgColumnName] = useState(getSavedUgColumn);
  const [ugSaveMsg, setUgSaveMsg] = useState("");
  const [maintMsg, setMaintMsg] = useState("");
  const [maintLoading, setMaintLoading] = useState("");
  const [dbSize, setDbSize] = useState(0);
  const [showAbout, setShowAbout] = useState(false);
  const DEFAULT_SCAN_EXTENSIONS = [".xlsx", ".xls", ".prt"];
  const [scanExtensions, setScanExtensions] = useState<string[]>(DEFAULT_SCAN_EXTENSIONS);
  const [newExt, setNewExt] = useState("");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logFilter, setLogFilter] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResults, setDiagResults] = useState<DiagResult | null>(null);

  useEffect(() => {
    settingsService.get("scan_extensions").then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setScanExtensions(parsed);
            return;
          }
        } catch { /* use defaults */ }
      }
    }).catch(() => { /* use defaults */ });
  }, []);

  useEffect(() => {
    getDbStats().then((stats) => {
      setDbSize(stats.fileSize);
    }).catch(() => { /* non-critical */ });
  }, []);

  const fetchLogs = async () => {
    setLogLoading(true);
    try {
      const entries = await getLogs(logFilter || undefined, 50);
      setLogs(entries);
    } catch {
      // non-critical
    } finally {
      setLogLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [logFilter]);

  const saveExtensions = async (exts: string[]) => {
    try {
      await settingsService.set("scan_extensions", JSON.stringify(exts));
    } catch { /* best-effort save */ }
  };

  const handleToggleExt = (ext: string) => {
    const next = scanExtensions.includes(ext)
      ? scanExtensions.filter((e) => e !== ext)
      : [...scanExtensions, ext];
    setScanExtensions(next);
    saveExtensions(next);
  };

  const handleAddExt = () => {
    const raw = newExt.trim().toLowerCase();
    if (!raw) return;
    const normalized = raw.startsWith(".") ? raw : `.${raw}`;
    if (scanExtensions.includes(normalized)) {
      setNewExt("");
      return;
    }
    const next = [...scanExtensions, normalized];
    setScanExtensions(next);
    setNewExt("");
    saveExtensions(next);
  };

  const handleRemoveExt = (ext: string) => {
    if (DEFAULT_SCAN_EXTENSIONS.includes(ext)) return;
    const next = scanExtensions.filter((e) => e !== ext);
    setScanExtensions(next);
    saveExtensions(next);
  };

  const displayExtensions = [...new Set([...DEFAULT_SCAN_EXTENSIONS, ...scanExtensions])];

  const handleThemeChange = async (newTheme: Theme) => {
    setTheme(newTheme);
    try {
      await settingsService.set("theme", newTheme);
    } catch {
      // Theme saved to localStorage via ThemeContext, DB save is best-effort
    }
  };

  const handleLocaleChange = async (newLocale: Locale) => {
    setLocale(newLocale);
    try {
      await settingsService.set("locale", newLocale);
    } catch {
      // Locale saved to localStorage via I18nContext, DB save is best-effort
    }
  };

  const handleUgColumnSave = () => {
    try {
      localStorage.setItem(UG_COLUMN_KEY, ugColumnName.trim() || "图号");
      setUgSaveMsg(t("settings.ugColumnNameSaved"));
      addToast("success", t("settings.ugColumnNameSaved"));
      setTimeout(() => setUgSaveMsg(""), 2000);
    } catch {
      setUgSaveMsg("Failed to save");
    }
  };

  const showMaintMsg = (msg: string, duration = 3000) => {
    setMaintMsg(msg);
    setTimeout(() => setMaintMsg(""), duration);
  };

  const handleBackup = async () => {
    try {
      const targetPath = await save({
        defaultPath: "zoobet-backup.db",
        filters: [{ name: "Database", extensions: ["db"] }],
        title: t("settings.backupDb"),
      });
      if (!targetPath) return;
      setMaintLoading("backup");
      const result = await settingsService.backup(targetPath);
      showMaintMsg(`${t("settings.backupSuccess")}: ${result.backup_path}`);
      addToast("success", t("settings.backupSuccess"));
    } catch (e) {
      showMaintMsg(`${t("settings.backupFail")}: ${e instanceof Error ? e.message : String(e)}`);
      addToast("error", t("settings.backupFail"));
    } finally {
      setMaintLoading("");
    }
  };

  const handleRestore = async () => {
    if (!window.confirm(t("settings.restoreConfirm"))) return;
    try {
      const sourcePath = await openDialog({
        multiple: false,
        filters: [{ name: "Database", extensions: ["db"] }],
        title: t("settings.restoreDb"),
      });
      if (!sourcePath || typeof sourcePath !== "string") return;
      setMaintLoading("restore");
      await settingsService.restore(sourcePath);
      showMaintMsg(t("settings.restoreSuccess"), 5000);
      addToast("success", t("settings.restoreSuccess"));
    } catch (e) {
      showMaintMsg(`${t("settings.restoreFail")}: ${e instanceof Error ? e.message : String(e)}`);
      addToast("error", t("settings.restoreFail"));
    } finally {
      setMaintLoading("");
    }
  };

  const handleRebuildIndex = async () => {
    if (!window.confirm(t("settings.rebuildConfirm"))) return;
    try {
      setMaintLoading("rebuild");
      const result = await settingsService.rebuildIndex();
      showMaintMsg(`${t("settings.rebuildSuccess")} (${result.deleted_vectors} ${t("statusBar.images")})`);
      addToast("success", t("settings.rebuildSuccess"));
    } catch (e) {
      showMaintMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setMaintLoading("");
    }
  };

  const handleClearCache = async () => {
    if (!window.confirm(t("settings.clearCacheConfirm"))) return;
    try {
      setMaintLoading("clear");
      const result = await settingsService.clearCache();
      showMaintMsg(`${t("settings.clearCacheSuccess")} (${result.cleaned_files} files)`);
      addToast("success", t("settings.clearCacheSuccess"));
    } catch (e) {
      showMaintMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setMaintLoading("");
    }
  };

  const logLevelLabel = (level: string): string => {
    if (level === "info") return t("settings.logLevelInfo");
    if (level === "warn") return t("settings.logLevelWarn");
    if (level === "error") return t("settings.logLevelError");
    return level;
  };

  const logSourceLabel = (source: string): string => {
    if (source === "scan") return t("settings.logSourceScan");
    if (source === "search") return t("settings.logSourceSearch");
    return source;
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleOptimize = async () => {
    if (!window.confirm(t("settings.optimizeConfirm"))) return;
    try {
      setMaintLoading("optimize");
      const result = await optimizeDb();
      setDbSize(result.newSize);
      showMaintMsg(
        `${t("settings.optimizeSuccess")} — ${t("settings.spaceFreed", { size: formatSize(result.freed) })}`,
        5000,
      );
      addToast("success", t("settings.optimizeSuccess"));
    } catch (e) {
      showMaintMsg(`${t("settings.optimizeFail")}: ${e instanceof Error ? e.message : String(e)}`);
      addToast("error", t("settings.optimizeFail"));
    } finally {
      setMaintLoading("");
    }
  };

  const handleDiagnostics = async () => {
    setDiagLoading(true);
    setDiagResults(null);
    try {
      const result = await callBackend<DiagResult>("system.diagnostics");
      setDiagResults(result);
    } catch (e) {
      setDiagResults({
        ok: false,
        checks: [{
          name: "Backend",
          status: "error",
          detail: e instanceof Error ? e.message : String(e),
          suggestion: "Check if the Python backend is running.",
        }],
        summary: { total: 1, passed: 0, failed: 1, warning: 0 },
      });
    } finally {
      setDiagLoading(false);
    }
  };

  const themeOptions: { value: Theme; labelKey: string }[] = [
    { value: "light", labelKey: "settings.themeLight" },
    { value: "dark", labelKey: "settings.themeDark" },
    { value: "system", labelKey: "settings.themeSystem" },
  ];

  const langOptions: { value: Locale; labelKey: string }[] = [
    { value: "zh", labelKey: "settings.langZh" },
    { value: "en", labelKey: "settings.langEn" },
  ];

  return (
    <div className="settings-page">
      <h2 className="page-title">{t("settings.title")}</h2>

      {/* Appearance */}
      <section className="settings-section">
        <h3>{t("settings.appearance")}</h3>

        <div className="settings-row">
          <label className="settings-label">{t("settings.theme")}</label>
          <div className="settings-options">
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                className={`settings-option-btn ${theme === opt.value ? "active" : ""}`}
                onClick={() => handleThemeChange(opt.value)}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-label">{t("settings.language")}</label>
          <div className="settings-options">
            {langOptions.map((opt) => (
              <button
                key={opt.value}
                className={`settings-option-btn ${locale === opt.value ? "active" : ""}`}
                onClick={() => handleLocaleChange(opt.value)}
              >
                {t(opt.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* UG Column Name */}
      <section className="settings-section">
        <h3>{t("settings.data")}</h3>

        <div className="settings-row">
          <label className="settings-label">{t("settings.ugColumnName")}</label>
          <div className="settings-input-group">
            <input
              type="text"
              className="settings-input"
              placeholder={t("settings.ugColumnNameHint")}
              value={ugColumnName}
              onChange={(e) => setUgColumnName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleUgColumnSave();
              }}
            />
            <button className="settings-btn-primary" onClick={handleUgColumnSave}>
              {t("common.save")}
            </button>
          </div>
        </div>

        {ugSaveMsg && <p className="settings-msg">{ugSaveMsg}</p>}

        <div className="settings-row" style={{ alignItems: "flex-start" }}>
          <label className="settings-label">{t("settings.scanExtensions")}</label>
          <div className="settings-ext-list">
            <p className="settings-ext-hint">{t("settings.scanExtensionsHint")}</p>
            {displayExtensions.map((ext) => (
              <label key={ext} className="settings-ext-item">
                <input
                  type="checkbox"
                  checked={scanExtensions.includes(ext)}
                  onChange={() => handleToggleExt(ext)}
                />
                <span>{ext}</span>
                {!DEFAULT_SCAN_EXTENSIONS.includes(ext) && (
                  <button
                    className="settings-ext-remove"
                    onClick={() => handleRemoveExt(ext)}
                    title={t("common.delete")}
                  >
                    ×
                  </button>
                )}
              </label>
            ))}
            <div className="settings-ext-add-row">
              <input
                type="text"
                className="settings-ext-input"
                placeholder={t("settings.scanExtensionsPlaceholder")}
                value={newExt}
                onChange={(e) => setNewExt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddExt();
                }}
              />
              <button className="settings-btn-primary" onClick={handleAddExt}>
                {t("settings.scanExtensionsAdd")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Maintenance */}
      <section className="settings-section">
        <h3>{t("settings.maintenance")}</h3>

        <div className="settings-row">
          <label className="settings-label">{t("settings.dbSize")}</label>
          <span className="settings-db-size">{formatSize(dbSize)}</span>
        </div>

        <div className="settings-maintenance-grid">
          <button
            className="settings-btn-secondary"
            onClick={handleBackup}
            disabled={maintLoading !== ""}
          >
            {maintLoading === "backup" ? `${t("common.loading")}` : t("settings.backupDb")}
          </button>
          <button
            className="settings-btn-secondary"
            onClick={handleRestore}
            disabled={maintLoading !== ""}
          >
            {maintLoading === "restore" ? `${t("common.loading")}` : t("settings.restoreDb")}
          </button>
          <button
            className="settings-btn-secondary"
            onClick={handleRebuildIndex}
            disabled={maintLoading !== ""}
          >
            {maintLoading === "rebuild" ? `${t("common.loading")}` : t("settings.rebuildIndex")}
          </button>
          <button
            className="settings-btn-secondary"
            onClick={handleClearCache}
            disabled={maintLoading !== ""}
          >
            {maintLoading === "clear" ? `${t("common.loading")}` : t("settings.clearCache")}
          </button>
          <button
            className="settings-btn-secondary"
            onClick={handleOptimize}
            disabled={maintLoading !== ""}
          >
            {maintLoading === "optimize" ? `${t("common.loading")}` : t("settings.optimizeDb")}
          </button>
        </div>

        {maintMsg && <p className="settings-msg" style={{ marginTop: 12 }}>{maintMsg}</p>}
      </section>

      {/* Activity Logs */}
      <section className="settings-section">
        <h3>{t("settings.logs")}</h3>

        <div className="settings-row" style={{ marginBottom: 8 }}>
          <div className="settings-options">
            {(["", "info", "warn", "error"] as const).map((level) => (
              <button
                key={level || "all"}
                className={`settings-option-btn ${logFilter === level ? "active" : ""}`}
                onClick={() => setLogFilter(level)}
              >
                {level === "" ? t("settings.logLevelAll") : logLevelLabel(level)}
              </button>
            ))}
          </div>
          <button
            className="settings-btn-secondary"
            onClick={fetchLogs}
            disabled={logLoading}
            style={{ marginLeft: "auto" }}
          >
            {logLoading ? t("common.loading") : t("common.retry")}
          </button>
        </div>

        <div className="settings-log-list">
          {logs.length === 0 && !logLoading && (
            <p className="settings-log-empty">{t("settings.logNoLogs")}</p>
          )}
          {logs.map((entry) => (
            <div key={entry.id} className={`settings-log-entry settings-log-${entry.level}`}>
              <span className="settings-log-time">
                {entry.created_at ? entry.created_at.slice(5, 19).replace("T", " ") : ""}
              </span>
              <span className={`settings-log-badge badge-${entry.level}`}>
                {logLevelLabel(entry.level)}
              </span>
              <span className="settings-log-source">{logSourceLabel(entry.source)}</span>
              <span className="settings-log-message">{entry.message}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Diagnostics */}
      <section className="settings-section">
        <h3>{t("settings.diagnostics")}</h3>

        <button
          className="settings-btn-secondary"
          onClick={handleDiagnostics}
          disabled={diagLoading}
        >
          {diagLoading ? t("settings.diagnosticsRunning") : t("settings.diagnosticsRun")}
        </button>

        {diagResults && (
          <div className="settings-diag-results">
            {diagResults.summary && (
              <p className={`settings-diag-summary ${diagResults.ok ? "all-ok" : "has-error"}`}>
                {diagResults.ok
                  ? t("settings.diagnosticsAllPassed")
                  : diagResults.summary.failed > 0
                    ? t("settings.diagnosticsFailed", { count: String(diagResults.summary.failed) })
                    : t("settings.diagnosticsWarning", { count: String(diagResults.summary.warning) })}
                <span className="settings-diag-count">
                  ({diagResults.summary.passed}/{diagResults.summary.total})
                </span>
              </p>
            )}
            <div className="settings-diag-list">
              {diagResults.checks.map((check, idx) => (
                <div key={idx} className={`settings-diag-item settings-diag-${check.status}`}>
                  <span className={`settings-diag-icon icon-${check.status}`}>
                    {check.status === "ok" ? "✓" : check.status === "warn" ? "⚠" : "✗"}
                  </span>
                  <div className="settings-diag-body">
                    <span className="settings-diag-name">{check.name}</span>
                    <span className="settings-diag-detail">{check.detail}</span>
                    {check.suggestion && (
                      <span className="settings-diag-suggestion">
                        {t("settings.diagnosticsSuggestion")}: {check.suggestion}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* About */}
      <section className="settings-section">
        <h3>{t("settings.about")}</h3>
        <button className="settings-btn-secondary" onClick={() => setShowAbout(true)}>
          {t("settings.aboutBtn")}
        </button>
      </section>

      {/* About Dialog */}
      {showAbout && (
        <div
          className="about-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAbout(false);
          }}
        >
          <div className="about-dialog">
            <button
              className="about-dialog-close"
              onClick={() => setShowAbout(false)}
              aria-label={t("common.close")}
            >
              &#x2715;
            </button>
            <div className="about-dialog-body">
              <div className="about-app-icon">Z</div>
              <h3 className="about-app-name">{t("settings.aboutAppName")}</h3>
              <p className="about-version">
                {t("settings.aboutVersion", { version: __APP_VERSION__ })}
              </p>
              <div className="about-tech-stack">
                <span className="about-tech-label">{t("settings.aboutTechStack")}</span>
                <span className="about-tech-badge">Tauri</span>
                <span className="about-tech-badge">React</span>
                <span className="about-tech-badge">Python</span>
                <span className="about-tech-badge">CLIP</span>
                <span className="about-tech-badge">FAISS</span>
              </div>
              <a
                className="about-github-link"
                href={t("settings.aboutGitHubUrl")}
                onClick={(e) => {
                  e.preventDefault();
                  open(t("settings.aboutGitHubUrl"));
                }}
              >
                <svg className="about-github-icon" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                {t("settings.aboutGitHub")}
              </a>
              <button
                className="about-close-btn"
                onClick={() => setShowAbout(false)}
              >
                {t("settings.aboutClose")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
