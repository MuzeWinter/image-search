import { invoke } from "@tauri-apps/api/core";
import { serviceRegistry } from "./registry";

function call(method: string, params?: unknown) {
  return invoke("call_backend", {
    method,
    params: params ?? {},
  });
}

serviceRegistry.register({
  name: "ocrService",
  status: "idle",
  start: async () => {
    // OCR loads lazily
  },
  invoke: <T>(method: string, params?: unknown) => call(method, params) as Promise<T>,
});

export interface OcrStatus {
  enabled: boolean;
  ready: boolean;
  error: string | null;
}

export interface OcrTextResult {
  text: string;
  confidence: number;
  bbox: number[][];
}

export interface OcrResult {
  results: OcrTextResult[];
  text: string;
  count: number;
}

export async function recognize(imageBase64: string): Promise<OcrResult> {
  await serviceRegistry.ensureReady("ocrService");
  return call("ocr.recognize", { image_base64: imageBase64 }) as Promise<OcrResult>;
}

export async function recognizeFromPath(filePath: string): Promise<OcrResult> {
  await serviceRegistry.ensureReady("ocrService");
  return call("ocr.recognize", { file_path: filePath }) as Promise<OcrResult>;
}

export async function getOcrStatus(): Promise<OcrStatus> {
  await serviceRegistry.ensureReady("ocrService");
  return call("ocr.getStatus") as Promise<OcrStatus>;
}

export async function setOcrEnabled(enabled: boolean): Promise<{ enabled: boolean }> {
  await serviceRegistry.ensureReady("ocrService");
  return call("ocr.setEnabled", { enabled }) as Promise<{ enabled: boolean }>;
}
