import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useI18n } from "../../i18n/context";
import { useToast } from "../../contexts/ToastContext";
import type { Library } from "../../services/types";

const STORAGE_KEY = "zoobet_welcome_done";

interface WelcomeGuideProps {
  onDone: () => void;
  onAddLibrary: (path: string) => Promise<Library>;
  onScan: (path: string) => Promise<void>;
}

export function WelcomeGuide({ onDone, onAddLibrary, onScan }: WelcomeGuideProps) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [step, setStep] = useState(1);
  const [libraryPath, setLibraryPath] = useState("");
  const [browsing, setBrowsing] = useState(false);
  const [scanning, setScanning] = useState(false);
  const totalSteps = 4;

  const handleBrowse = async () => {
    try {
      setBrowsing(true);
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("welcome.step2Browse"),
      });
      if (selected && typeof selected === "string") {
        setLibraryPath(selected);
      }
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setBrowsing(false);
    }
  };

  const handleNextStep2 = async () => {
    if (!libraryPath.trim()) {
      addToast("warning", t("welcome.step2NoPath"));
      return;
    }
    try {
      await onAddLibrary(libraryPath);
      setStep(3);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : String(e));
    }
  };

  const handleScan = async () => {
    try {
      setScanning(true);
      await onScan(libraryPath);
      addToast("success", t("libraries.scanComplete"));
      setStep(4);
    } catch (e) {
      addToast("error", e instanceof Error ? e.message : String(e));
    } finally {
      setScanning(false);
    }
  };

  const handleDone = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch { /* ignore */ }
    onDone();
  };

  return (
    <div className="welcome-overlay">
      <div className="welcome-dialog">
        {/* Progress dots */}
        <div className="welcome-progress">
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`welcome-dot${i + 1 === step ? " active" : ""}${i + 1 < step ? " done" : ""}`}
            />
          ))}
        </div>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="welcome-step">
            <div className="welcome-icon">&#x1F50D;</div>
            <h2 className="welcome-title">{t("welcome.step1Title")}</h2>
            <p className="welcome-desc">{t("welcome.step1Desc")}</p>
            <div className="welcome-actions">
              <button className="welcome-btn-primary" onClick={() => setStep(2)}>
                {t("common.next")}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Select Library */}
        {step === 2 && (
          <div className="welcome-step">
            <div className="welcome-icon">&#x1F4C1;</div>
            <h2 className="welcome-title">{t("welcome.step2Title")}</h2>
            <p className="welcome-desc">{t("welcome.step2Desc")}</p>
            <div className="welcome-path-row">
              <input
                type="text"
                className="welcome-path-input"
                value={libraryPath}
                onChange={(e) => setLibraryPath(e.target.value)}
                placeholder="G:\Drawings"
                readOnly
              />
              <button
                className="welcome-btn-secondary"
                onClick={handleBrowse}
                disabled={browsing}
              >
                {browsing ? "..." : t("welcome.step2Browse")}
              </button>
            </div>
            <div className="welcome-actions">
              <button className="welcome-btn-ghost" onClick={() => setStep(3)}>
                {t("common.skip")}
              </button>
              <button
                className="welcome-btn-primary"
                onClick={handleNextStep2}
                disabled={!libraryPath.trim()}
              >
                {t("common.next")}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: First Scan */}
        {step === 3 && (
          <div className="welcome-step">
            <div className="welcome-icon">&#x2699;</div>
            <h2 className="welcome-title">{t("welcome.step3Title")}</h2>
            <p className="welcome-desc">{t("welcome.step3Desc")}</p>
            <div className="welcome-actions">
              <button className="welcome-btn-ghost" onClick={() => setStep(4)}>
                {t("welcome.step3Skip")}
              </button>
              <button
                className="welcome-btn-primary"
                onClick={handleScan}
                disabled={scanning}
              >
                {scanning ? t("libraries.scanning") : t("welcome.step3ScanNow")}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="welcome-step">
            <div className="welcome-icon">&#x1F389;</div>
            <h2 className="welcome-title">{t("welcome.step4Title")}</h2>
            <p className="welcome-desc">{t("welcome.step4Desc")}</p>
            <div className="welcome-actions">
              <button className="welcome-btn-primary" onClick={handleDone}>
                {t("welcome.step4Start")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Hook that checks if welcome has been shown and returns control */
export function useWelcomeState(): [boolean, () => void] {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem(STORAGE_KEY);
      if (!done) {
        setShow(true);
      }
    } catch {
      setShow(true);
    }
  }, []);

  const dismiss = () => setShow(false);

  return [show, dismiss];
}
