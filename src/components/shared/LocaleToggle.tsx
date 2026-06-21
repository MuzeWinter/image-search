import { useI18n } from "../../i18n/context";
import { Tooltip } from "./Tooltip";

export function LocaleToggle() {
  const { t, locale, setLocale } = useI18n();

  function toggle() {
    setLocale(locale === "zh" ? "en" : "zh");
  }

  return (
    <Tooltip content={t("common.switchLocale")}>
      <button
        className="toggle-btn locale-toggle"
        onClick={toggle}
        aria-label={t("common.switchLocale")}
      >
        {locale === "zh" ? "EN" : "中"}
      </button>
    </Tooltip>
  );
}
