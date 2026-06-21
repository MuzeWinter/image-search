import { useState, useEffect } from "react";
import { useI18n, type Locale } from "../i18n/context";
import { useToast } from "../contexts/ToastContext";
import { useTheme, type Theme } from "../contexts/ThemeContext";
import * as settingsService from "../services/settingsService";
import { open, save } from "@tauri-apps/plugin-dialog";

const UG_COLUMN_KEY = "ugColumnName";

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
  const DEFAULT_SCAN_EXTENSIONS = [".xlsx", ".xls", ".prt"];
  const [scanExtensions, setScanExtensions] = useState<string[]>(DEFAULT_SCAN_EXTENSIONS);
  const [newExt, setNewExt] = useState("");

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
      const sourcePath = await open({
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
        </div>

        {maintMsg && <p className="settings-msg" style={{ marginTop: 12 }}>{maintMsg}</p>}
      </section>

      {/* About */}
      <section className="settings-section">
        <h3>{t("settings.about")}</h3>
        <p>{t("settings.versionText")}</p>
      </section>
    </div>
  );
}
