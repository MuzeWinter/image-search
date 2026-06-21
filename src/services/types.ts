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
  excel_image_count?: number;
  auto_matches?: number;
  auto_indexed?: number;
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

// ── CAD File ──────────────────────────────────────────────────

export interface CadFile {
  cad_id: string;
  file_path: string;
  folder: string | null;
  filename: string | null;
  extension: string | null;
  size_bytes: number | null;
  file_hash: string | null;
  img_ref: string | null;
  tags: string | null;
  notes: string | null;
  status: string;
  last_modified: string | null;
  indexed_at: string;
}

// ── PDF File ──────────────────────────────────────────────────

export interface PdfFile {
  doc_id: string;
  file_path: string;
  folder: string | null;
  filename: string | null;
  size_bytes: number | null;
  page_count: number | null;
  file_hash: string | null;
  preview_path: string | null;
  img_ref: string | null;
  tags: string | null;
  notes: string | null;
  status: string;
  last_modified: string | null;
  indexed_at: string;
}

// ── Match ─────────────────────────────────────────────────────

export interface MatchRecord {
  id: number;
  img_id: string;
  ex_id: string | null;
  cad_id: string | null;
  pdf_id: string | null;
  status: string;
  method: string | null;
  confidence: string | null;
  created_at: string | null;
  updated_at: string | null;
  img_filename?: string | null;
  img_path?: string | null;
  excel_filename?: string | null;
  excel_path?: string | null;
  sheet_name?: string | null;
  cad_filename?: string | null;
  cad_path?: string | null;
  cad_ext?: string | null;
  pdf_filename?: string | null;
  pdf_path?: string | null;
  page_count?: number | null;
}

export interface MatchStats {
  auto: number;
  suspected: number;
  confirmed: number;
  rejected: number;
  unmatched: number;
  total: number;
}

// ── Tag ──────────────────────────────────────────────────

export interface TagInfo {
  name: string;
  count: number;
  color?: string;
}

// ── UseServiceQuery ──────────────────────────────────────────

export interface ServiceQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}
