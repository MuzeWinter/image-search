import { useTheme, type Theme } from "../../contexts/ThemeContext";
import { useI18n } from "../../i18n/context";
import { Tooltip } from "./Tooltip";

const themeOrder: Theme[] = ["light", "dark", "system"];

const iconMap: Record<Theme, string> = {
  light: "☀",
  dark: "☾",
  system: "◐",
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();

  function cycle() {
    const idx = themeOrder.indexOf(theme);
    setTheme(themeOrder[(idx + 1) % themeOrder.length]);
  }

  return (
    <Tooltip content={t(`theme.${theme}`)}>
      <button
        className="toggle-btn theme-toggle"
        onClick={cycle}
        aria-label={t(`theme.${theme}`)}
      >
        {iconMap[theme]}
      </button>
    </Tooltip>
  );
}
