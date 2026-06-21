import { useState, useEffect } from "react";
import { useI18n, type Locale } from "../i18n/context";
import { useTheme, type Theme } from "../contexts/ThemeContext";
import { useServiceQuery } from "../stores/hooks";
import * as settingsService from "../services/settingsService";
import * as libraryService from "../services/libraryService";
import * as ocrService from "../services/ocrService";
import type { Library } from "../services/types";
import { Skeleton } from "../components/shared/Skeleton";
import { open, save } from "@tauri-apps/plugin-dialog";

export default function Settings() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [libPath, setLibPath] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [ocrEnabled, setOcrEnabled] = useState(false);
  const [maintMsg, setMaintMsg] = useState("");
  const [maintLoading, setMaintLoading] = useState("");

  const {
    data: libraries,
    loading: libsLoading,
    error: libsError,
    refetch: refetchLibs,
  } = useServiceQuery<Library[]>("libraryService", "library.list");

  useEffect(() => {
    ocrService.getOcrStatus().then((s) => setOcrEnabled(s.enabled)).catch(() => {});
  }, []);

  const handleOcrToggle = async () => {
    const next = !ocrEnabled;
    setOcrEnabled(next);
    try {
      await ocrService.setOcrEnabled(next);
      await settingsService.set("ocr.enabled", next ? "1" : "0");
    } catch {
      // best-effort
    }
  };

  const handleThemeChange = async (newTheme: Theme) => {
    setTheme(newTheme);
    try {
      await settingsService.set("theme", newTheme);
    } catch {
      // Settings saved to localStorage via ThemeContext, DB save is best-effort
    }
  };

  const handleLocaleChange = async (newLocale: Locale) => {
    setLocale(newLocale);
    try {
      await settingsService.set("locale", newLocale);
    } catch {
      // Settings saved to localStorage via I18nContext, DB save is best-effort
    }
  };

  const handleBrowse = async () => {
    try {
      const selected = await open({ directory: true, multiple: false, title: t("library.selectFolder") });
      if (selected && typeof selected === "string") {
        setLibPath(selected);
      }
    } catch {
      // dialog cancelled or error
    }
  };

  const handleAddLibrary = async () => {
    const path = libPath.trim();
    if (!path) return;
    try {
      await libraryService.add(path);
      setLibPath("");
      setSaveMsg(t("common.saved"));
      refetchLibs();
      setTimeout(() => setSaveMsg(""), 2000);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const handleRemoveLibrary = async (id: number, path: string) => {
    if (!window.confirm(t("library.deleteConfirm", { path }))) return;
    try {
      await libraryService.remove(id);
      refetchLibs();
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : String(e));
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
    } catch (e) {
      showMaintMsg(`${t("settings.backupFail")}: ${e instanceof Error ? e.message : String(e)}`);
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
    } catch (e) {
      showMaintMsg(`${t("settings.restoreFail")}: ${e instanceof Error ? e.message : String(e)}`);
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

      {/* AI Features */}
      <section className="settings-section">
        <h3>AI</h3>

        <div className="settings-row">
          <label className="settings-label">{t("ocr.enable")}</label>
          <div className="settings-options">
            <button
              className={`settings-option-btn ${ocrEnabled ? "active" : ""}`}
              onClick={handleOcrToggle}
            >
              ON
            </button>
            <button
              className={`settings-option-btn ${!ocrEnabled ? "active" : ""}`}
              onClick={handleOcrToggle}
            >
              OFF
            </button>
          </div>
        </div>
        <p className="text-sm text-muted" style={{ marginTop: 4 }}>{t("ocr.enableDesc")}</p>
      </section>

      {/* Data */}
      <section className="settings-section">
        <h3>{t("settings.data")}</h3>

        <div className="settings-row">
          <label className="settings-label">{t("settings.libraryPath")}</label>
          <div className="settings-input-group">
            <input
              type="text"
              className="settings-input"
              placeholder={t("settings.libraryPathHint")}
              value={libPath}
              onChange={(e) => setLibPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddLibrary();
              }}
            />
            <button className="settings-btn-secondary" onClick={handleBrowse}>
              {t("settings.browseBtn")}
            </button>
            <button className="settings-btn-primary" onClick={handleAddLibrary}>
              {t("settings.addLibrary")}
            </button>
          </div>
        </div>

        {saveMsg && <p className="settings-msg">{saveMsg}</p>}

        <div className="settings-libraries">
          <h4>{t("settings.libraries")}</h4>
          {libsLoading ? (
            <Skeleton variant="text" lines={3} />
          ) : libsError ? (
            <p className="settings-error">{libsError}</p>
          ) : libraries && libraries.length > 0 ? (
            <ul className="settings-lib-list">
              {libraries.map((lib) => (
                <li key={lib.id} className="settings-lib-item">
                  <span className="settings-lib-path" title={lib.path}>
                    {lib.label || lib.path}
                  </span>
                  <span className="settings-lib-meta">
                    {lib.image_count} {t("statusBar.images")}
                  </span>
                  <button
                    className="settings-btn-danger"
                    onClick={() => handleRemoveLibrary(lib.id, lib.label || lib.path)}
                  >
                    {t("common.delete")}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="settings-empty">{t("settings.noLibraries")}</p>
          )}
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
