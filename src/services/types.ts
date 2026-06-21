// ── Service types ────────────────────────────────────────────

export type ServiceStatus = "idle" | "starting" | "ready" | "error";

export interface ServiceDescriptor {
  name: string;
  status: ServiceStatus;
  start: () => Promise<void>;
  invoke: <T>(method: string, params?: unknown) => Promise<T>;
  stop?: () => Promise<void>;
}

// ── Library ──────────────────────────────────────────────────

export interface Library {
  id: number;
  path: string;
  label: string | null;
  file_count: number;
  image_count: number;
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
  ex_ref: string | null;
  cad_ref: string | null;
  pdf_ref: string | null;
  tags: string | null;
  notes: string | null;
  favorite: number;
  status: string;
  last_modified: string | null;
  indexed_at: string;
}

// ── Stats ────────────────────────────────────────────────────

export interface SystemStats {
  libraries: number;
  images: number;
  excelRecords: number;
  cadFiles: number;
  pdfFiles: number;
}

// ── Scan ───────────────────────────────────────────────────────

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
  error?: string;
}

export interface ScanHistory {
  id: number;
  library_id: number;
  scan_type: string;
  added: number;
  removed: number;
  modified: number;
  moved: number;
  errors: number;
  duration_sec: number;
  scanned_at: string;
}

export interface ChangeLog {
  id: number;
  change_type: string;
  img_id: string | null;
  ex_id: string | null;
  cad_id: string | null;
  doc_id: string | null;
  old_value: string | null;
  new_value: string | null;
  file_path: string;
  status: string;
  created_at: string;
}

export interface ExcelRecord {
  ex_id: string;
  file_path: string;
  folder: string | null;
  filename: string | null;
  sheet_name: string;
  row_number: number;
  column_name: string | null;
  cell_value: string | null;
  has_image: number;
  file_hash: string | null;
  last_modified: string | null;
  indexed_at: string;
}

// ── UseServiceQuery ──────────────────────────────────────────

export interface ServiceQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}
