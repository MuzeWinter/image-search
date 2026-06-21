import { useI18n } from "../../i18n/context";

export function LocaleToggle() {
  const { locale, setLocale } = useI18n();

  function toggle() {
    setLocale(locale === "zh" ? "en" : "zh");
  }

  return (
    <button
      className="toggle-btn locale-toggle"
      onClick={toggle}
      title={locale === "zh" ? "Switch to English" : "切换到中文"}
      aria-label={locale === "zh" ? "Switch to English" : "切换到中文"}
    >
      {locale === "zh" ? "EN" : "中"}
    </button>
  );
}
