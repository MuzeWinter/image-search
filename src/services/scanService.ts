import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { callBackend, callTauri } from "./ipc";
import { serviceRegistry } from "./registry";
import type {
  ScanProgress,
  ScanResult,
  ScanHistory,
  ChangeLog,
  CheckChangesResult,
  ExcelRecord,
  ParseExcelResult,
  ExtractExcelImagesResult,
} from "./types";

serviceRegistry.register({
  name: "excel",
  status: "idle",
  start: async () => {},
  invoke: <T>(method: string, params?: Record<string, unknown>) =>
    callBackend<T>(method, params),
});

serviceRegistry.register({
  name: "scanService",
  status: "idle",
  start: async () => {},
  invoke: <T>(method: string, params?: Record<string, unknown>) =>
    callBackend<T>(method, params),
});

// ── Scan control ─────────────────────────────────────────────

export async function startScan(
  libraryId: number,
  libraryPath: string,
): Promise<ScanResult> {
  return callTauri<ScanResult>("scan_library", {
    libraryId,
    libraryPath,
  });
}

// ── Folder watch ──────────────────────────────────────────────

export interface WatchStatus {
  active: boolean;
  paths: string[];
}

export async function startFolderWatch(paths: string[]): Promise<WatchStatus> {
  return callTauri<WatchStatus>("start_folder_watch", { paths });
}

export async function stopFolderWatch(): Promise<{ status: string }> {
  return callTauri<{ status: string }>("stop_folder_watch");
}

export async function getWatchStatus(): Promise<WatchStatus> {
  return callTauri<WatchStatus>("get_watch_status");
}

export async function cancelScan(): Promise<{ cancelled: boolean }> {
  return callTauri<{ cancelled: boolean }>("cancel_scan");
}

export async function checkChanges(
  libraryId: number,
): Promise<CheckChangesResult> {
  await serviceRegistry.ensureReady("scanService");
  return callBackend<CheckChangesResult>("scan.checkChanges", {
    library_id: libraryId,
  });
}

export function onScanProgress(
  callback: (progress: ScanProgress) => void,
): Promise<UnlistenFn> {
  return listen<ScanProgress>("scan-progress", (event) => {
    callback(event.payload);
  });
}

// ── Scan history ─────────────────────────────────────────────

export async function getScanHistory(): Promise<ScanHistory[]> {
  await serviceRegistry.ensureReady("dbService");
  return callBackend<ScanHistory[]>("db.query", {
    sql: "SELECT * FROM scan_history ORDER BY scanned_at DESC LIMIT 50",
  });
}

export async function getScanHistoryByLibrary(
  libraryId: number,
): Promise<ScanHistory[]> {
  await serviceRegistry.ensureReady("dbService");
  return callBackend<ScanHistory[]>("db.query", {
    sql: "SELECT * FROM scan_history WHERE library_id = ? ORDER BY scanned_at DESC LIMIT 20",
    params: [libraryId],
  });
}

// ── Change logs ──────────────────────────────────────────────

export async function getChangeLogs(limit = 50): Promise<ChangeLog[]> {
  await serviceRegistry.ensureReady("dbService");
  return callBackend<ChangeLog[]>("db.query", {
    sql: "SELECT * FROM change_logs ORDER BY created_at DESC LIMIT ?",
    params: [limit],
  });
}

export async function getChangeLogsByLibrary(
  libraryPath: string,
  limit = 50,
): Promise<ChangeLog[]> {
  await serviceRegistry.ensureReady("dbService");
  return callBackend<ChangeLog[]>("db.query", {
    sql: "SELECT * FROM change_logs WHERE file_path LIKE ? ORDER BY created_at DESC LIMIT ?",
    params: [libraryPath + "%", limit],
  });
}

// ── Excel ────────────────────────────────────────────────────

export async function parseExcel(
  filePath: string,
  libraryPath?: string,
): Promise<ParseExcelResult> {
  await serviceRegistry.ensureReady("excel");
  return callBackend<ParseExcelResult>("excel.parse", {
    file_path: filePath,
    library_path: libraryPath,
  });
}

export async function listExcelRecords(
  filePath?: string,
): Promise<ExcelRecord[]> {
  await serviceRegistry.ensureReady("excel");
  return callBackend<ExcelRecord[]>("excel.listRecords", {
    file_path: filePath ?? null,
  });
}

export async function extractExcelImages(
  filePath: string,
  libraryPath?: string,
): Promise<ExtractExcelImagesResult> {
  await serviceRegistry.ensureReady("excel");
  return callBackend<ExtractExcelImagesResult>("excel.extractImages", {
    file_path: filePath,
    library_path: libraryPath,
  });
}
