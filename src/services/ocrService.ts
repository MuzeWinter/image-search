import { callBackend } from "./ipc";
import { serviceRegistry } from "./registry";

serviceRegistry.register({
  name: "ocrService",
  status: "idle",
  start: async () => {
    // OCR loads lazily
  },
  invoke: <T>(method: string, params?: Record<string, unknown>) =>
    callBackend<T>(method, params),
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
  return callBackend<OcrResult>("ocr.recognize", {
    image_base64: imageBase64,
  });
}

export async function recognizeFromPath(
  filePath: string,
): Promise<OcrResult> {
  await serviceRegistry.ensureReady("ocrService");
  return callBackend<OcrResult>("ocr.recognize", { file_path: filePath });
}

export async function getOcrStatus(): Promise<OcrStatus> {
  await serviceRegistry.ensureReady("ocrService");
  return callBackend<OcrStatus>("ocr.getStatus");
}

export async function setOcrEnabled(
  enabled: boolean,
): Promise<{ enabled: boolean }> {
  await serviceRegistry.ensureReady("ocrService");
  return callBackend<{ enabled: boolean }>("ocr.setEnabled", { enabled });
}
