import { callBackend } from "./ipc";
import { serviceRegistry } from "./registry";

serviceRegistry.register({
  name: "aiService",
  status: "idle",
  start: async () => {
    // AI service starts lazily — model loaded on first use
  },
  invoke: <T>(method: string, params?: Record<string, unknown>) =>
    callBackend<T>(method, params),
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

export async function loadModel(): Promise<{
  ok: boolean;
  device: string;
  status: string;
}> {
  await serviceRegistry.ensureReady("aiService");
  return callBackend<{ ok: boolean; device: string; status: string }>(
    "ai_search.loadModel",
  );
}

export async function getModelStatus(): Promise<ModelStatus> {
  await serviceRegistry.ensureReady("aiService");
  return callBackend<ModelStatus>("ai_search.getModelStatus");
}

export async function extractFeatures(
  imageBase64: string,
): Promise<ExtractResult> {
  await serviceRegistry.ensureReady("aiService");
  return callBackend<ExtractResult>("ai_search.extractFeatures", {
    image_base64: imageBase64,
  });
}

export async function extractFeaturesFromPath(
  filePath: string,
): Promise<ExtractResult> {
  await serviceRegistry.ensureReady("aiService");
  return callBackend<ExtractResult>("ai_search.extractFeaturesFromPath", {
    file_path: filePath,
  });
}
