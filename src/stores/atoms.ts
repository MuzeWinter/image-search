import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Library, SystemStats, CheckChangesResult } from "../services/types";

export const serviceStatusAtom = atom<Record<string, string>>({});

export const librariesAtom = atom<Library[]>([]);

export const statsAtom = atom<SystemStats | null>(null);

export const statsLoadingAtom = atom(true);

export const themeAtom = atomWithStorage<"light" | "dark" | "system">(
  "theme",
  "light",
);

export const localeAtom = atomWithStorage<"zh" | "en">("locale", "zh");

/** Incremented on each Escape keypress to signal cancel/clear to pages */
export const escapeEpochAtom = atom(0);

/** Aggregated pending change counts across all libraries (auto-detected on startup) */
export const pendingChangesAtom = atom<CheckChangesResult | null>(null);

/** Splash screen state for model loading progress */
export const splashStateAtom = atom<{
  visible: boolean;
  percent: number;
  message: string;
}>({ visible: false, percent: 0, message: "" });

/** Startup --search argument: file path for automatic search on launch */
export const startupSearchPathAtom = atom<string | null>(null);
