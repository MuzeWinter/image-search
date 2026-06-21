import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Library, SystemStats } from "../services/types";

export const serviceStatusAtom = atom<Record<string, string>>({});

export const librariesAtom = atom<Library[]>([]);

export const statsAtom = atom<SystemStats | null>(null);

export const statsLoadingAtom = atom(true);

export const themeAtom = atomWithStorage<"light" | "dark" | "system">(
  "theme",
  "light",
);

export const localeAtom = atomWithStorage<"zh" | "en">("locale", "zh");
