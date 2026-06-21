import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";

// ── Mocks must be declared before any imports ──

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: vi.fn((p: string) => `asset://${p}`),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("react-window", () => ({
  List: vi.fn(() => null),
  Grid: vi.fn(() => null),
}));

vi.mock("../services/searchService", () => ({
  getModelStatus: vi.fn(() =>
    Promise.resolve({ status: "ready", percent: 100, message: "", device: null, error: null }),
  ),
  searchByImage: vi.fn(() =>
    Promise.resolve({
      results: [
        {
          img_id: "img-001",
          source_type: "file_image" as const,
          image_path: "/path/to/img.jpg",
          origin_path: "/path/to/img.jpg",
          sheet_name: null,
          row_number: null,
          ug_ref: null,
          similarity: 0.95,
        },
      ],
      count: 1,
      duration_ms: 120,
    }),
  ),
  searchByPath: vi.fn(() =>
    Promise.resolve({
      results: [] as any[],
      count: 0,
      duration_ms: 0,
      query_file: "",
    }),
  ),
  resetModel: vi.fn(() => Promise.resolve({ ok: true })),
}));

vi.mock("../services/ipc", () => ({
  callTauri: vi.fn(() => Promise.resolve()),
}));

vi.mock("../services/libraryService", () => ({
  list: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../services/systemService", () => ({
  openFile: vi.fn(),
  openFolder: vi.fn(),
}));

vi.mock("../services/searchHistoryStore", () => ({
  getHistory: vi.fn(() => []),
  addHistory: vi.fn((h: any) => [h]),
  deleteHistoryByIndex: vi.fn(() => []),
  clearHistory: vi.fn(),
  createThumbnail: vi.fn(() => Promise.resolve("")),
}));

vi.mock("../stores/hooks", () => ({
  useServiceQuery: vi.fn(() => ({ data: null })),
}));

// jotai: return sensible defaults for atoms used by Search
vi.mock("jotai", async () => {
  const actual = await vi.importActual<typeof import("jotai")>("jotai");
  return {
    ...actual,
    useAtomValue: vi.fn(() => 0),
    useSetAtom: vi.fn(() => vi.fn()),
  };
});

// ── Now import the component ──

import Search from "../pages/Search";
import { ToastProvider } from "../contexts/ToastContext";
import { I18nProvider } from "../i18n/context";

// Polyfills for jsdom
class MockDataTransfer {
  files: FileList;
  items: {
    add: (f: File) => void;
  };
  private _files: File[] = [];
  constructor() {
    this.files = this._files as unknown as FileList;
    this.items = {
      add: (f: File) => {
        this._files.push(f);
      },
    };
  }
}
(window as any).DataTransfer = MockDataTransfer;

// Polyfill browser APIs not available in jsdom
const MockResizeObserver = vi.fn(function(this: any, _cb: any) {
  this.observe = vi.fn();
  this.unobserve = vi.fn();
  this.disconnect = vi.fn();
});
(window as any).ResizeObserver = MockResizeObserver;

const MockIntersectionObserver = vi.fn(function(this: any, _cb: any, _opts?: any) {
  this.observe = vi.fn();
  this.unobserve = vi.fn();
  this.disconnect = vi.fn();
});
(window as any).IntersectionObserver = MockIntersectionObserver;

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <I18nProvider>
        {children}
      </I18nProvider>
    </ToastProvider>
  );
}

function mockFileReader() {
  const orig = (window as any).FileReader;
  (window as any).FileReader = class MockFR {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    result = "data:image/png;base64,ZmFrZQ==";
    readAsDataURL(_f: File) {
      this.result = "data:image/png;base64,ZmFrZQ==";
      Promise.resolve().then(() => this.onload?.());
    }
  };
  return () => { (window as any).FileReader = orig; };
}

function triggerFileSelect(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const dt = new DataTransfer();
  dt.items.add(file);
  Object.defineProperty(input, "files", { value: dt.files, configurable: true });
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("Search — state flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders idle state with dropzone and summary cards", () => {
    render(<Search />, { wrapper: Wrapper });

    expect(screen.getByText("Image Search")).toBeInTheDocument();

    // Drop zone — actual i18n English text
    expect(screen.getByText("Drop an image here to search")).toBeInTheDocument();
    expect(screen.getByText("Drag & drop, paste (Ctrl+V), or click to select an image")).toBeInTheDocument();

    // Summary cards
    expect(screen.getByText("Libraries")).toBeInTheDocument();
    expect(screen.getByText("Indexed Images")).toBeInTheDocument();
    expect(screen.getByText("Last Scan")).toBeInTheDocument();
  });

  it("renders scope bar with filter buttons", () => {
    render(<Search />, { wrapper: Wrapper });

    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("Excel Embedded")).toBeInTheDocument();
    expect(screen.getByText("UG Preview")).toBeInTheDocument();
  });

  it("shows error state when search service fails", async () => {
    const { searchByImage } = await import("../services/searchService");
    vi.mocked(searchByImage).mockRejectedValueOnce(new Error("Search failed"));

    render(<Search />, { wrapper: Wrapper });

    const restoreFR = mockFileReader();
    const file = new File(["fake-image-data"], "test.png", { type: "image/png" });

    await act(async () => { triggerFileSelect(file); });

    // Error message: "Error: Search failed" (t("common.error") + ": " + errorMsg)
    await waitFor(() => {
      expect(screen.getByText(/Search failed/)).toBeInTheDocument();
    }, { timeout: 3000 });

    restoreFR();
  });

  it("shows results when search succeeds", async () => {
    render(<Search />, { wrapper: Wrapper });

    const restoreFR = mockFileReader();
    const file = new File(["fake-image-data"], "test.png", { type: "image/png" });

    await act(async () => { triggerFileSelect(file); });

    // Wait for "Results" heading (t("search.results"))
    await waitFor(() => {
      expect(screen.getByText("Results")).toBeInTheDocument();
    }, { timeout: 3000 });

    // Result item
    expect(screen.getByText("img-001")).toBeInTheDocument();
    expect(screen.getByText("95.0%")).toBeInTheDocument();

    restoreFR();
  });
});
