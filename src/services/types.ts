// ── Service types ────────────────────────────────────────────

export type ServiceStatus = "idle" | "starting" | "ready" | "error";

export interface ServiceDescriptor {
  name: string;
  status: ServiceStatus;
  start: () => Promise<void>;
  invoke: <T>(method: string, params?: Record<string, unknown>) => Promise<T>;
  stop?: () => Promise<void>;
}

// ── Library ──────────────────────────────────────────────────

export interface Library {
  id: number;
  path: string;
  label: string | null;
  file_count: number;
  image_count: number;
  prt_count: number;
  last_scan: string | null;
  status: string;
  created_at: string;
}

// ── Image ────────────────────────────────────────────────────

export interface ImageRecord {
  img_id: string;
  source_type: string;
  file_path: string;
  folder: string | null;
  filename: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  file_hash: string | null;
  vector_id: number | null;
  tags: string | null;
  notes: string | null;
  favorite: number;
  status: string;
  last_modified: string | null;
  indexed_at: string;
}

// ── Search ───────────────────────────────────────────────────

export interface SearchResult {
  img_id: string;
  source_type: string;
  file_path: string;
  folder: string | null;
  filename: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  tags: string[];
  favorite: boolean;
  similarity: number;
}

// ── Stats ────────────────────────────────────────────────────

export interface SystemStats {
  libraries: number;
  images: number;
  excelEmbedded: number;
  ugPreviews: number;
}

// ── Scan ─────────────────────────────────────────────────────

export interface ScanProgress {
  type: "progress";
  phase: "collecting" | "hashing" | "comparing" | "saving";
  current: number;
  total: number;
  current_file: string;
  percent: number;
}

export interface ScanResult {
  type: "result";
  added: number;
  removed: number;
  modified: number;
  moved: number;
  errors: number;
  duration_sec: number;
  total_files: number;
  excel_count: number;
  image_count: number;
  cad_count: number;
  pdf_count: number;
  other_count: number;
  excel_image_count?: number;
  auto_matches?: number;
  auto_indexed?: number;
  error?: string;
}

export interface ScanHistory {
  id: number;
  library_id: number | null;
  scan_type: string;
  added: number;
  removed: number;
  modified: number;
  moved: number;
  errors: number;
  duration_sec: number;
  created_at: string;
}

export interface ChangeLog {
  id: number;
  change_type: string;
  file_path: string | null;
  old_value: string | null;
  new_value: string | null;
  status: string;
  created_at: string;
}

export interface ExcelRecord {
  ex_id: string;
  file_path: string;
  folder: string | null;
  filename: string | null;
  sheet_name: string | null;
  row_number: number | null;
  column_name: string | null;
  cell_value: string | null;
  has_image: number;
  file_hash: string | null;
  last_modified: string | null;
  indexed_at: string;
}

export interface ParseExcelResult {
  ok: boolean;
  records_parsed: number;
  file_path: string;
}

export interface ExtractExcelImagesResult {
  ok: boolean;
  images_extracted: number;
  file_path: string;
}
