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
  source_type: "excel-embedded" | "ug-preview" | "file_image";
  image_path: string;
  origin_path: string;
  sheet_name: string | null;
  row_number: number | null;
  ug_ref: string | null;
  similarity: number;
  ocr_text?: string;
  size_bytes?: number | null;
  width?: number | null;
  height?: number | null;
  last_modified?: string | null;
  format?: string;
  source_query_indices?: number[];
  prt_files?: string[];
}

export interface SearchResults {
  results: SearchResultItem[];
  count: number;
  duration_ms: number;
}

export interface PerQueryStat {
  query_index: number;
  results: number;
  duration_ms: number;
  error?: string;
}

export interface BatchSearchResults extends SearchResults {
  query_count: number;
  per_query_stats: PerQueryStat[];
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
  libraryId?: number,
): Promise<SearchResults> {
  await serviceRegistry.ensureReady("searchService");
  const params: Record<string, unknown> = {
    image_base64: imageBase64,
    top_k: topK ?? 20,
    scope: scope ?? "all",
  };
  if (libraryId != null) {
    params.library_id = libraryId;
  }
  return callBackend<SearchResults>("search.searchByImage", params);
}

export async function searchByPath(
  filePath: string,
  topK?: number,
  scope?: SearchScope,
  libraryId?: number,
): Promise<SearchByPathResults> {
  await serviceRegistry.ensureReady("searchService");
  const params: Record<string, unknown> = {
    file_path: filePath,
    top_k: topK ?? 20,
    scope: scope ?? "all",
  };
  if (libraryId != null) {
    params.library_id = libraryId;
  }
  return callBackend<SearchByPathResults>("search.searchByPath", params);
}

export async function batchSearchByImages(
  imagesBase64: string[],
  topK?: number,
  scope?: SearchScope,
  libraryId?: number,
): Promise<BatchSearchResults> {
  await serviceRegistry.ensureReady("searchService");
  const params: Record<string, unknown> = {
    images_base64: imagesBase64,
    top_k: topK ?? 20,
    scope: scope ?? "all",
  };
  if (libraryId != null) {
    params.library_id = libraryId;
  }
  return callBackend<BatchSearchResults>("search.batchSearchByImages", params);
}

export async function searchByVector(
  vector: number[],
  topK?: number,
  scope?: SearchScope,
  libraryId?: number,
): Promise<SearchResults> {
  await serviceRegistry.ensureReady("searchService");
  const params: Record<string, unknown> = {
    vector,
    top_k: topK ?? 20,
    scope: scope ?? "all",
  };
  if (libraryId != null) {
    params.library_id = libraryId;
  }
  return callBackend<SearchResults>("search.searchByVector", params);
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

export async function resetModel(): Promise<{ ok: boolean }> {
  return callBackend<{ ok: boolean }>("search.resetModel");
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

export interface FindPrtFilesResult {
  directory: string;
  prt_files: string[];
  count: number;
}

export async function findPrtFiles(
  imagePath?: string,
  directory?: string,
): Promise<FindPrtFilesResult> {
  await serviceRegistry.ensureReady("searchService");
  const params: Record<string, unknown> = {};
  if (imagePath) params.image_path = imagePath;
  if (directory) params.directory = directory;
  return callBackend<FindPrtFilesResult>("search.findPrtFiles", params);
}

export interface PrtImageResult {
  img_id: string;
  source_type: string;
  file_path: string;
  image_path: string | null;
  origin_path: string | null;
  folder: string | null;
  filename: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  sheet_name: string | null;
  row_number: number | null;
  ug_ref: string | null;
  ocr_text: string | null;
  ex_ref: string | null;
  cad_ref: string | null;
  pdf_ref: string | null;
  favorite: boolean;
  tags: string[];
  format: string;
}

export interface FindImagesByPrtPathResult {
  prt_path: string;
  ug_ref: string;
  images: PrtImageResult[];
  count: number;
}

export async function findImagesByPrtPath(
  prtPath: string,
): Promise<FindImagesByPrtPathResult> {
  await serviceRegistry.ensureReady("searchService");
  return callBackend<FindImagesByPrtPathResult>("search.findImagesByPrtPath", {
    prt_path: prtPath,
  });
}
