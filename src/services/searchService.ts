import { invoke } from "@tauri-apps/api/core";
import { serviceRegistry } from "./registry";

function call(method: string, params?: unknown) {
  return invoke("call_backend", {
    method,
    params: params ?? {},
  });
}

serviceRegistry.register({
  name: "searchService",
  status: "idle",
  start: async () => {
    // Search service starts lazily
  },
  invoke: <T>(method: string, params?: unknown) => call(method, params) as Promise<T>,
});

export interface ExcelInfo {
  ex_id: string;
  file_path: string;
  filename: string;
  sheet_name: string;
  row_number: number;
  column_name: string;
  cell_value: string;
}

export interface CadInfo {
  cad_id: string;
  file_path: string;
  filename: string;
  extension: string;
}

export interface PdfInfo {
  doc_id: string;
  file_path: string;
  filename: string;
  page_count: number;
}

export interface SearchResultItem {
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
  ex_ref: string | null;
  excel_info: ExcelInfo | null;
  cad_ref: string | null;
  cad_info: CadInfo | null;
  pdf_ref: string | null;
  pdf_info: PdfInfo | null;
}

export interface SearchResults {
  results: SearchResultItem[];
  count: number;
  duration_ms: number;
}

export interface SearchByPathResults extends SearchResults {
  query_file: string;
  query_vector_dim?: number;
}

export interface IndexStatus {
  built: boolean;
  count: number;
  dim: number;
}

export interface EmbeddingItem {
  id: number;
  img_id: string;
  vector_dim: number;
  created_at: string;
  filename: string | null;
  source_type: string | null;
}

export async function searchByImage(imageBase64: string, topK?: number): Promise<SearchResults> {
  await serviceRegistry.ensureReady("searchService");
  return call("search.searchByImage", { image_base64: imageBase64, top_k: topK ?? 20 }) as Promise<SearchResults>;
}

export async function searchByPath(filePath: string, topK?: number): Promise<SearchByPathResults> {
  await serviceRegistry.ensureReady("searchService");
  return call("search.searchByPath", { file_path: filePath, top_k: topK ?? 20 }) as Promise<SearchByPathResults>;
}

export async function searchByVector(vector: number[], topK?: number): Promise<SearchResults> {
  await serviceRegistry.ensureReady("searchService");
  return call("search.searchByVector", { vector, top_k: topK ?? 20 }) as Promise<SearchResults>;
}

export async function buildIndex(): Promise<{ ok: boolean; count: number; dim?: number }> {
  await serviceRegistry.ensureReady("searchService");
  return call("search.buildIndex") as Promise<{ ok: boolean; count: number; dim?: number }>;
}

export async function getIndexStatus(): Promise<IndexStatus> {
  await serviceRegistry.ensureReady("searchService");
  return call("search.getIndexStatus") as Promise<IndexStatus>;
}

export async function indexImage(imgId: string, imageBase64: string): Promise<{ ok: boolean; img_id: string; vector_dim: number }> {
  await serviceRegistry.ensureReady("searchService");
  return call("search.indexImage", { img_id: imgId, image_base64: imageBase64 }) as Promise<{ ok: boolean; img_id: string; vector_dim: number }>;
}

export async function batchIndex(limit?: number): Promise<{ ok: boolean; indexed: number; errors: unknown[]; total_checked: number }> {
  await serviceRegistry.ensureReady("searchService");
  return call("search.batchIndex", { limit: limit ?? 50 }) as Promise<{ ok: boolean; indexed: number; errors: unknown[]; total_checked: number }>;
}

export async function listEmbeddings(limit?: number, offset?: number): Promise<{ items: EmbeddingItem[]; total: number }> {
  await serviceRegistry.ensureReady("searchService");
  return call("search.listEmbeddings", { limit: limit ?? 100, offset: offset ?? 0 }) as Promise<{ items: EmbeddingItem[]; total: number }>;
}

export async function deleteEmbedding(imgId: string): Promise<{ ok: boolean; deleted: string }> {
  await serviceRegistry.ensureReady("searchService");
  return call("search.deleteEmbedding", { img_id: imgId }) as Promise<{ ok: boolean; deleted: string }>;
}
