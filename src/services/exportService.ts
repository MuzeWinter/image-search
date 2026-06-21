import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface ExportItemInput {
  image_path: string;
  img_id: string;
  origin_path: string;
  similarity: number;
  source_type: string;
  sheet_name?: string | null;
  row_number?: number | null;
  ug_ref?: string | null;
  ocr_text?: string | null;
  width?: number | null;
  height?: number | null;
  format?: string | null;
  size_bytes?: number | null;
}

export interface ExportProgress {
  task: "zip" | "pdf";
  current: number;
  total: number;
  message: string;
}

export async function exportZip(
  outputPath: string,
  items: ExportItemInput[],
): Promise<string> {
  return invoke("export_zip", { outputPath, items }) as Promise<string>;
}

export async function exportPdf(
  outputPath: string,
  items: ExportItemInput[],
): Promise<string> {
  return invoke("export_pdf", { outputPath, items }) as Promise<string>;
}

export async function copyImageToClipboard(imagePath: string): Promise<void> {
  return invoke("copy_image_to_clipboard", { imagePath }) as Promise<void>;
}

export async function openFileManager(filePath: string): Promise<void> {
  return invoke("open_file_manager", { filePath }) as Promise<void>;
}

export function onExportProgress(
  callback: (progress: ExportProgress) => void,
): Promise<UnlistenFn> {
  return listen<ExportProgress>("export-progress", (event) => {
    callback(event.payload);
  });
}
