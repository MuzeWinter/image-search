import { useI18n } from "../../i18n/context";

export function LocaleToggle() {
  const { t, locale, setLocale } = useI18n();

  function toggle() {
    setLocale(locale === "zh" ? "en" : "zh");
  }

  return (
    <button
      className="toggle-btn locale-toggle"
      onClick={toggle}
      title={t("common.switchLocale")}
      aria-label={t("common.switchLocale")}
    >
      {locale === "zh" ? "EN" : "中"}
    </button>
  );
}
