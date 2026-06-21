import { callBackend } from "./ipc";
import { serviceRegistry } from "./registry";

serviceRegistry.register({
  name: "searchService",
  status: "idle",
  start: async () => {
    // Search service starts lazily
  },
  invoke: <T>(method: string, params?: Record<string, unknown>) =>
    callBackend<T>(method, params),
});

export interface SearchResultItem {
  img_id: string;
  source_type: "excel-embedded" | "ug-preview";
  image_path: string;
  origin_path: string;
  sheet_name: string | null;
  row_number: number | null;
  ug_ref: string | null;
  similarity: number;
  ocr_text?: string;
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

export type SearchScope = "all" | "excel_only" | "ug_only";

export async function searchByImage(
  imageBase64: string,
  topK?: number,
  scope?: SearchScope,
): Promise<SearchResults> {
  await serviceRegistry.ensureReady("searchService");
  return callBackend<SearchResults>("search.searchByImage", {
    image_base64: imageBase64,
    top_k: topK ?? 20,
    scope: scope ?? "all",
  });
}

export async function searchByPath(
  filePath: string,
  topK?: number,
  scope?: SearchScope,
): Promise<SearchByPathResults> {
  await serviceRegistry.ensureReady("searchService");
  return callBackend<SearchByPathResults>("search.searchByPath", {
    file_path: filePath,
    top_k: topK ?? 20,
    scope: scope ?? "all",
  });
}

export async function searchByVector(
  vector: number[],
  topK?: number,
  scope?: SearchScope,
): Promise<SearchResults> {
  await serviceRegistry.ensureReady("searchService");
  return callBackend<SearchResults>("search.searchByVector", {
    vector,
    top_k: topK ?? 20,
    scope: scope ?? "all",
  });
}

export async function buildIndex(): Promise<{
  ok: boolean;
  count: number;
  dim?: number;
}> {
  await serviceRegistry.ensureReady("searchService");
  return callBackend<{ ok: boolean; count: number; dim?: number }>(
    "search.buildIndex",
  );
}

export async function getIndexStatus(): Promise<IndexStatus> {
  await serviceRegistry.ensureReady("searchService");
  return callBackend<IndexStatus>("search.getIndexStatus");
}

export async function indexImage(
  imgId: string,
  imageBase64: string,
): Promise<{ ok: boolean; img_id: string; vector_dim: number }> {
  await serviceRegistry.ensureReady("searchService");
  return callBackend<{ ok: boolean; img_id: string; vector_dim: number }>(
    "search.indexImage",
    { img_id: imgId, image_base64: imageBase64 },
  );
}

export async function batchIndex(
  limit?: number,
): Promise<{
  ok: boolean;
  indexed: number;
  errors: unknown[];
  total_checked: number;
}> {
  await serviceRegistry.ensureReady("searchService");
  return callBackend<{
    ok: boolean;
    indexed: number;
    errors: unknown[];
    total_checked: number;
  }>("search.batchIndex", { limit: limit ?? 50 });
}

export async function listEmbeddings(
  limit?: number,
  offset?: number,
): Promise<{ items: EmbeddingItem[]; total: number }> {
  await serviceRegistry.ensureReady("searchService");
  return callBackend<{ items: EmbeddingItem[]; total: number }>(
    "search.listEmbeddings",
    { limit: limit ?? 100, offset: offset ?? 0 },
  );
}

export interface ModelStatus {
  status: "idle" | "loading" | "ready" | "error";
  percent: number;
  message: string;
  device: string | null;
  error: string | null;
}

export async function getModelStatus(): Promise<ModelStatus> {
  return callBackend<ModelStatus>("search.modelStatus");
}

export async function deleteEmbedding(
  imgId: string,
): Promise<{ ok: boolean; deleted: string }> {
  await serviceRegistry.ensureReady("searchService");
  return callBackend<{ ok: boolean; deleted: string }>(
    "search.deleteEmbedding",
    { img_id: imgId },
  );
}
