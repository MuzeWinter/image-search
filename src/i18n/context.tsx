import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import zh from "./zh.json";
import en from "./en.json";

export type Locale = "zh" | "en";

const messages: Record<Locale, Record<string, unknown>> = { zh, en };

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>(null!);

function resolve(key: string, obj: Record<string, unknown>): string {
  const keys = key.split(".");
  let current: unknown = obj;
  for (const k of keys) {
    if (current == null || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[k];
  }
  return typeof current === "string" ? current : key;
}

function getSavedLocale(): Locale {
  try {
    const saved = localStorage.getItem("locale");
    if (saved === "en" || saved === "zh") return saved;
  } catch { /* localStorage unavailable */ }
  return "zh";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getSavedLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem("locale", l); } catch { /* ignore */ }
    document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      let value = resolve(key, messages[locale]);
      if (params && typeof value === "string") {
        for (const [k, v] of Object.entries(params)) {
          value = value.replace(`{${k}}`, String(v));
        }
      }
      return value;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
