import { useI18n } from "../i18n/context";

interface SplashScreenProps {
  percent: number;
  message: string;
}

export function SplashScreen({ percent, message }: SplashScreenProps) {
  const { t } = useI18n();

  return (
    <div className="splash-overlay">
      <div className="splash-card">
        <h1 className="splash-brand">{t("splash.appName")}</h1>
        <p className="splash-version">
          {t("splash.version", { version: __APP_VERSION__ })}
        </p>
        <div className="splash-progress-container">
          <div className="splash-progress-track">
            <div
              className="splash-progress-fill"
              style={{ width: `${Math.max(percent, 2)}%` }}
            />
          </div>
          <p className="splash-progress-pct">{Math.round(percent)}%</p>
        </div>
        <p className="splash-status">{message || t("splash.preparing")}</p>
      </div>
    </div>
  );
}
