import { invoke } from "@tauri-apps/api/core";
import { serviceRegistry } from "./registry";

function call(method: string, params?: unknown) {
  return invoke("call_backend", {
    method,
    params: params ?? {},
  });
}

serviceRegistry.register({
  name: "aiService",
  status: "idle",
  start: async () => {
    // AI service starts lazily — model loaded on first use
  },
  invoke: <T>(method: string, params?: unknown) => call(method, params) as Promise<T>,
});

export interface ModelStatus {
  status: "idle" | "loading" | "ready" | "error";
  percent: number;
  message: string;
  device: string | null;
  error: string | null;
}

export interface ExtractResult {
  vector: number[];
  dim: number;
  device: string;
}

export async function loadModel(): Promise<{ ok: boolean; device: string; status: string }> {
  await serviceRegistry.ensureReady("aiService");
  return call("ai_search.loadModel") as Promise<{ ok: boolean; device: string; status: string }>;
}

export async function getModelStatus(): Promise<ModelStatus> {
  await serviceRegistry.ensureReady("aiService");
  return call("ai_search.getModelStatus") as Promise<ModelStatus>;
}

export async function extractFeatures(imageBase64: string): Promise<ExtractResult> {
  await serviceRegistry.ensureReady("aiService");
  return call("ai_search.extractFeatures", { image_base64: imageBase64 }) as Promise<ExtractResult>;
}

export async function extractFeaturesFromPath(filePath: string): Promise<ExtractResult> {
  await serviceRegistry.ensureReady("aiService");
  return call("ai_search.extractFeaturesFromPath", { file_path: filePath }) as Promise<ExtractResult>;
}
