export interface SearchHistoryItem {
  /** Base64 data URL (JPEG thumbnail), kept under ~10KB */
  thumbnail: string;
  /** Date.now() when the search was performed */
  timestamp: number;
  /** Number of results returned */
  resultCount: number;
}

const STORAGE_KEY = "zoobet_search_history";
const MAX_ITEMS = 20;
const MAX_THUMBNAIL_BYTES = 10240;

function load(): SearchHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data
      .filter(
        (item: unknown): item is SearchHistoryItem =>
          item !== null &&
          typeof item === "object" &&
          typeof (item as Record<string, unknown>).thumbnail === "string" &&
          typeof (item as Record<string, unknown>).timestamp === "number" &&
          typeof (item as Record<string, unknown>).resultCount === "number",
      )
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function save(items: SearchHistoryItem[]): void {
  try {
    const trimmed = items.slice(0, MAX_ITEMS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage full or unavailable — silently skip
  }
}

/**
 * Create a small JPEG thumbnail from a base64 image.
 * Resizes to 100×100 center-crop and compresses to fit within maxBytes.
 */
export function createThumbnail(
  base64: string,
  maxBytes: number = MAX_THUMBNAIL_BYTES,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 100;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }

      // Center-crop to square
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;
      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

      // Compress to JPEG with quality that fits within maxBytes
      let quality = 0.6;
      let dataUrl = canvas.toDataURL("image/jpeg", quality);
      // data URL character length ≈ bytes × 1.37 (base64 overhead + header)
      // So maxBytes * 1.4 is a safe upper bound for char count
      const maxChars = maxBytes * 1.4;
      if (dataUrl.length > maxChars) {
        quality = 0.25;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error("Failed to load image for thumbnail"));
    img.src = base64;
  });
}

export function getHistory(): SearchHistoryItem[] {
  return load();
}

export function addHistory(item: SearchHistoryItem): SearchHistoryItem[] {
  const items = load();
  items.unshift(item);
  const trimmed = items.slice(0, MAX_ITEMS);
  save(trimmed);
  return trimmed;
}

export function deleteHistoryByIndex(index: number): SearchHistoryItem[] {
  const items = load();
  if (index < 0 || index >= items.length) return items;
  items.splice(index, 1);
  save(items);
  return items;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
