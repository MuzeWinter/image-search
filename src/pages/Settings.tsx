import { useState } from "react";
import { useI18n, type Locale } from "../i18n/context";
import { useTheme, type Theme } from "../contexts/ThemeContext";
import { useServiceQuery } from "../stores/hooks";
import * as settingsService from "../services/settingsService";
import * as libraryService from "../services/libraryService";
import type { Library } from "../services/types";
import { Skeleton } from "../components/shared/Skeleton";

export default function Settings() {
  const { t, locale, setLocale } = useI18n();
  const { theme, setTheme } = useTheme();
  const [libPath, setLibPath] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

  const {
    data: libraries,
    loading: libsLoading,
    error: libsError,
    refetch: refetchLibs,
  } = useServiceQuery<Library[]>("libraryService", "library.list");

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

  const handleRemoveLibrary = async (id: number) => {
    try {
      await libraryService.remove(id);
      refetchLibs();
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : String(e));
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
                    onClick={() => handleRemoveLibrary(lib.id)}
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

      {/* About */}
      <section className="settings-section">
        <h3>{t("settings.about")}</h3>
        <p>{t("settings.versionText")}</p>
      </section>
    </div>
  );
}
