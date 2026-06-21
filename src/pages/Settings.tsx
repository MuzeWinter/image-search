import { useState, useEffect, useCallback } from "react";
import { useI18n, type Locale } from "../i18n/context";
import { useToast } from "../contexts/ToastContext";
import { useTheme, type Theme } from "../contexts/ThemeContext";
import * as settingsService from "../services/settingsService";
import { getDbStats, optimizeDb } from "../services/settingsService";
import { getLogs, type ActivityLog } from "../services/dbService";
import * as libraryService from "../services/libraryService";
import * as scanService from "../services/scanService";
import { callBackend } from "../services/ipc";
import { open as openDialog, save } from "@tauri-apps/plugin-dialog";
import { open } from "@tauri-apps/plugin-shell";
import { Tooltip } from "../components/shared/Tooltip";

const UG_COLUMN_KEY = "ugColumnName";
const SIMILARITY_THRESHOLD_KEY = "similarityThreshold";
const SCAN_OCR_KEY = "scan_ocr_enabled";
const SCAN_UG_PREVIEW_KEY = "scan_ug_preview_enabled";
const SCAN_EXTENSIONS_KEY = "scan_extensions_local";
const ACCENT_COLOR_KEY = "accentColor";

const ACCENT_PRESETS = [
  { key: "blue",   color: "oklch(55% 0.16 250)", labelKey: "settings.accentBlue" },
  { key: "green",  color: "oklch(55% 0.16 150)", labelKey: "settings.accentGreen" },
  { key: "purple", color: "oklch(52% 0.17 300)", labelKey: "settings.accentPurple" },
  { key: "orange", color: "oklch(58% 0.17 45)",  labelKey: "settings.accentOrange" },
  { key: "red",    color: "oklch(52% 0.19 20)",  labelKey: "settings.accentRed" },
];

const DEFAULT_SCAN_EXTENSIONS = [".xlsx", ".xls", ".prt"];

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

function getSavedSimilarityThreshold(): number {
  try {
    const saved = localStorage.getItem(SIMILARITY_THRESHOLD_KEY);
    if (saved) {
      const n = parseInt(saved, 10);
      if (!isNaN(n) && n >= 0 && n <= 100) return n;
    }
  } catch { /* localStorage unavailable */ }
  return 30;
}

function getSavedScanOcr(): boolean {
  try {
    const saved = localStorage.getItem(SCAN_OCR_KEY);
    if (saved !== null) return saved === "true";
  } catch { /* localStorage unavailable */ }
  return true;
}

function getSavedScanUgPreview(): boolean {
  try {
    const saved = localStorage.getItem(SCAN_UG_PREVIEW_KEY);
    if (saved !== null) return saved === "true";
  } catch { /* localStorage unavailable */ }
  return true;
}

function getSavedScanExtensions(): string[] {
  try {
    const saved = localStorage.getItem(SCAN_EXTENSIONS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* localStorage unavailable */ }
  return [".xlsx", ".xls", ".prt"];
}

function getSavedAccentColor(): string | null {
  try {
    const saved = localStorage.getItem(ACCENT_COLOR_KEY);
    if (saved && ACCENT_PRESETS.some((p) => p.key === saved)) return saved;
  } catch { /* localStorage unavailable */ }
  return null;
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
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [scanExtensions, setScanExtensions] = useState<string[]>(getSavedScanExtensions);
  const [newExt, setNewExt] = useState("");
  const [autoMonitor, setAutoMonitor] = useState(false);
  const [similarityThreshold, setSimilarityThreshold] = useState(getSavedSimilarityThreshold);
  const [scanOcrEnabled, setScanOcrEnabled] = useState(getSavedScanOcr);
  const [scanUgPreviewEnabled, setScanUgPreviewEnabled] = useState(getSavedScanUgPreview);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logFilter, setLogFilter] = useState("");
  const [logLoading, setLogLoading] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResults, setDiagResults] = useState<DiagResult | null>(null);
  const [accentColor, setAccentColor] = useState<string | null>(getSavedAccentColor);

  const applyAccentColor = (key: string | null) => {
    if (key) {
      const preset = ACCENT_PRESETS.find((p) => p.key === key);
      if (preset) {
        document.documentElement.style.setProperty("--accent", preset.color);
      }
    } else {
      document.documentElement.style.removeProperty("--accent");
    }
  };

  const handleAccentChange = (key: string) => {
    setAccentColor(key);
    try { localStorage.setItem(ACCENT_COLOR_KEY, key); } catch { /* ignore */ }
    applyAccentColor(key);
  };

  // Restore accent color on mount
  useEffect(() => {
    const saved = getSavedAccentColor();
    if (saved) applyAccentColor(saved);
  }, []);

  useEffect(() => {
    // Load scan extensions: localStorage first, fallback to backend DB
    const localExts = getSavedScanExtensions();
    if (localExts.length > 0 && localExts.some((e) => !DEFAULT_SCAN_EXTENSIONS.includes(e))) {
      // localStorage has non-default extensions, use them
      setScanExtensions(localExts);
      return;
    }
    // Otherwise load from backend DB
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
    // Load OCR and UG preview toggles from backend DB as fallback
    settingsService.get("scan_ocr_enabled").then((val) => {
      if (val !== null) setScanOcrEnabled(val === "true");
    }).catch(() => {});
    settingsService.get("scan_ug_preview_enabled").then((val) => {
      if (val !== null) setScanUgPreviewEnabled(val === "true");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    settingsService.get("folder_watch_enabled").then((val) => {
      if (val === "true") {
        setAutoMonitor(true);
      }
    }).catch(() => { /* use default (off) */ });
  }, []);

  useEffect(() => {
    getDbStats().then((stats) => {
      setDbSize(stats.fileSize);
    }).catch(() => { /* non-critical */ });
  }, []);

  const fetchLogs = useCallback(async () => {
    setLogLoading(true);
    try {
      const entries = await getLogs(logFilter || undefined, 50);
      setLogs(entries);
    } catch {
      // non-critical
    } finally {
      setLogLoading(false);
    }
  }, [logFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const saveExtensions = async (exts: string[]) => {
    try {
      localStorage.setItem(SCAN_EXTENSIONS_KEY, JSON.stringify(exts));
    } catch { /* best-effort */ }
    try {
      await settingsService.set("scan_extensions", JSON.stringify(exts));
    } catch { /* best-effort save */ }
  };

  const handleToggleOcr = (enabled: boolean) => {
    setScanOcrEnabled(enabled);
    try { localStorage.setItem(SCAN_OCR_KEY, String(enabled)); } catch { /* ignore */ }
    settingsService.set("scan_ocr_enabled", String(enabled)).catch(() => {});
  };

  const handleToggleUgPreview = (enabled: boolean) => {
    setScanUgPreviewEnabled(enabled);
    try { localStorage.setItem(SCAN_UG_PREVIEW_KEY, String(enabled)); } catch { /* ignore */ }
    settingsService.set("scan_ug_preview_enabled", String(enabled)).catch(() => {});
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

  const handleAutoMonitorToggle = async (enabled: boolean) => {
    setAutoMonitor(enabled);
    try {
      await settingsService.set("folder_watch_enabled", String(enabled));
      if (enabled) {
        const libs = await libraryService.list();
        const paths = libs.map((l) => l.path);
        await scanService.startFolderWatch(paths);
      } else {
        await scanService.stopFolderWatch();
      }
    } catch {
      // Best-effort
    }
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

  const handleResetDefaults = async () => {
    setShowResetConfirm(false);
    try {
      // Clear localStorage
      localStorage.removeItem("theme");
      localStorage.removeItem("locale");
      localStorage.removeItem(UG_COLUMN_KEY);
      localStorage.removeItem(SIMILARITY_THRESHOLD_KEY);
      localStorage.removeItem(SCAN_OCR_KEY);
      localStorage.removeItem(SCAN_UG_PREVIEW_KEY);
      localStorage.removeItem(SCAN_EXTENSIONS_KEY);
      localStorage.removeItem(ACCENT_COLOR_KEY);
      document.documentElement.style.removeProperty("--accent");
      // Reset DB settings to defaults
      await Promise.all([
        settingsService.set("theme", "light"),
        settingsService.set("locale", "zh"),
        settingsService.set("scan_extensions", JSON.stringify(DEFAULT_SCAN_EXTENSIONS)),
        settingsService.set("folder_watch_enabled", "false"),
        settingsService.set("scan_ocr_enabled", "true"),
        settingsService.set("scan_ug_preview_enabled", "true"),
      ]);
      // Stop folder watch if active
      scanService.stopFolderWatch().catch(() => {});
    } catch {
      // Best-effort: some DB settings may not have been stored yet
    }
    addToast("success", t("settings.resetDefaultsSuccess"));
    // Brief delay so the toast is visible before reload
    setTimeout(() => window.location.reload(), 600);
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

        <div className="settings-row">
          <label className="settings-label">{t("settings.accentColor")}</label>
          <div className="settings-accent-swatches">
            {ACCENT_PRESETS.map((preset) => (
              <button
                key={preset.key}
                className={`settings-accent-swatch ${accentColor === preset.key ? "active" : ""}`}
                style={{ backgroundColor: preset.color }}
                onClick={() => handleAccentChange(preset.key)}
                title={t(preset.labelKey)}
                aria-label={t(preset.labelKey)}
              />
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

        <div className="settings-row">
          <label className="settings-label">{t("settings.autoMonitor")}</label>
          <div className="settings-toggle-group">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={autoMonitor}
                onChange={(e) => handleAutoMonitorToggle(e.target.checked)}
              />
              <span className="settings-toggle-slider" />
            </label>
            <span className="settings-toggle-desc">
              {t("settings.autoMonitorDesc")}
            </span>
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-label">{t("settings.similarityThreshold")}</label>
          <div className="settings-slider-group">
            <input
              type="range"
              className="settings-slider"
              min="0"
              max="100"
              value={similarityThreshold}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSimilarityThreshold(v);
                try { localStorage.setItem(SIMILARITY_THRESHOLD_KEY, String(v)); } catch { /* ignore */ }
              }}
            />
            <span className="settings-slider-value">{similarityThreshold}%</span>
          </div>
        </div>
        <p className="settings-ext-hint">{t("settings.similarityThresholdHint")}</p>

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
                  <Tooltip content={t("common.delete")}>
                    <button
                      className="settings-ext-remove"
                      onClick={() => handleRemoveExt(ext)}
                    >
                      ×
                    </button>
                  </Tooltip>
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

        <div className="settings-row">
          <label className="settings-label">{t("settings.scanOcrEnabled")}</label>
          <div className="settings-toggle-group">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={scanOcrEnabled}
                onChange={(e) => handleToggleOcr(e.target.checked)}
              />
              <span className="settings-toggle-slider" />
            </label>
            <span className="settings-toggle-desc">
              {t("settings.scanOcrEnabledHint")}
            </span>
          </div>
        </div>

        <div className="settings-row">
          <label className="settings-label">{t("settings.scanUgPreviewEnabled")}</label>
          <div className="settings-toggle-group">
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={scanUgPreviewEnabled}
                onChange={(e) => handleToggleUgPreview(e.target.checked)}
              />
              <span className="settings-toggle-slider" />
            </label>
            <span className="settings-toggle-desc">
              {t("settings.scanUgPreviewEnabledHint")}
            </span>
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
            {maintLoading === "backup" ? <><span className="btn-spinner" />{t("common.loading")}</> : t("settings.backupDb")}
          </button>
          <button
            className="settings-btn-secondary"
            onClick={handleRestore}
            disabled={maintLoading !== ""}
          >
            {maintLoading === "restore" ? <><span className="btn-spinner" />{t("common.loading")}</> : t("settings.restoreDb")}
          </button>
          <button
            className="settings-btn-secondary"
            onClick={handleRebuildIndex}
            disabled={maintLoading !== ""}
          >
            {maintLoading === "rebuild" ? <><span className="btn-spinner" />{t("common.loading")}</> : t("settings.rebuildIndex")}
          </button>
          <button
            className="settings-btn-secondary"
            onClick={handleClearCache}
            disabled={maintLoading !== ""}
          >
            {maintLoading === "clear" ? <><span className="btn-spinner" />{t("common.loading")}</> : t("settings.clearCache")}
          </button>
          <button
            className="settings-btn-secondary"
            onClick={handleOptimize}
            disabled={maintLoading !== ""}
          >
            {maintLoading === "optimize" ? <><span className="btn-spinner" />{t("common.loading")}</> : t("settings.optimizeDb")}
          </button>
        </div>

        <button
          className="settings-btn-reset-danger"
          onClick={() => setShowResetConfirm(true)}
          disabled={maintLoading !== ""}
        >
          {t("settings.resetDefaults")}
        </button>

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
            {logLoading ? <><span className="btn-spinner" />{t("common.loading")}</> : t("common.retry")}
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
          {diagLoading ? <><span className="btn-spinner" />{t("settings.diagnosticsRunning")}</> : t("settings.diagnosticsRun")}
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
            <Tooltip content={t("common.close")}>
              <button
                className="about-dialog-close"
                onClick={() => setShowAbout(false)}
                aria-label={t("common.close")}
              >
                &#x2715;
              </button>
            </Tooltip>
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

      {/* Reset Defaults Confirm Dialog */}
      {showResetConfirm && (
        <div
          className="reset-confirm-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowResetConfirm(false);
          }}
        >
          <div className="reset-confirm-dialog">
            <Tooltip content={t("common.close")}>
              <button
                className="reset-confirm-dialog-close"
                onClick={() => setShowResetConfirm(false)}
                aria-label={t("common.close")}
              >
                &#x2715;
              </button>
            </Tooltip>
            <div className="reset-confirm-body">
              <h3 className="reset-confirm-title">{t("settings.resetDefaultsTitle")}</h3>
              <p className="reset-confirm-desc">{t("settings.resetDefaultsDesc")}</p>
              <ul className="reset-confirm-list">
                <li className="reset-confirm-list-item">{t("settings.resetDefaultsItemTheme")}</li>
                <li className="reset-confirm-list-item">{t("settings.resetDefaultsItemLocale")}</li>
                <li className="reset-confirm-list-item">{t("settings.resetDefaultsItemUgColumn")}</li>
                <li className="reset-confirm-list-item">{t("settings.resetDefaultsItemExtensions")}</li>
                <li className="reset-confirm-list-item">{t("settings.resetDefaultsItemAccent")}</li>
                <li className="reset-confirm-list-item">{t("settings.resetDefaultsItemCache")}</li>
              </ul>
              <div className="reset-confirm-actions">
                <button
                  className="reset-confirm-cancel-btn"
                  onClick={() => setShowResetConfirm(false)}
                >
                  {t("common.cancel")}
                </button>
                <button
                  className="reset-confirm-danger-btn"
                  onClick={handleResetDefaults}
                >
                  {t("settings.resetDefaultsConfirm")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
