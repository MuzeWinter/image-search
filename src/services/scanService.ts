import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { serviceRegistry } from "./registry";
import type { ScanProgress, ScanResult, ScanHistory, ChangeLog, ExcelRecord } from "./types";

function call(method: string, params?: unknown) {
  return invoke("call_backend", {
    method,
    params: params ?? {},
  });
}

serviceRegistry.register({
  name: "excel",
  status: "idle",
  start: async () => {},
  invoke: <T>(method: string, params?: unknown) => call(method, params) as Promise<T>,
});

// ── Scan control ─────────────────────────────────────────────

export async function startScan(
  libraryId: number,
  libraryPath: string,
): Promise<ScanResult> {
  return invoke("scan_library", {
    libraryId,
    libraryPath,
  }) as Promise<ScanResult>;
}

export async function cancelScan(): Promise<{ cancelled: boolean }> {
  return invoke("cancel_scan") as Promise<{ cancelled: boolean }>;
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
  return call("db.query", {
    sql: "SELECT * FROM scan_history ORDER BY scanned_at DESC LIMIT 50",
  }) as Promise<ScanHistory[]>;
}

export async function getScanHistoryByLibrary(
  libraryId: number,
): Promise<ScanHistory[]> {
  await serviceRegistry.ensureReady("dbService");
  return call("db.query", {
    sql: "SELECT * FROM scan_history WHERE library_id = ? ORDER BY scanned_at DESC LIMIT 20",
    params: [libraryId],
  }) as Promise<ScanHistory[]>;
}

// ── Change logs ──────────────────────────────────────────────

export async function getChangeLogs(limit = 50): Promise<ChangeLog[]> {
  await serviceRegistry.ensureReady("dbService");
  return call("db.query", {
    sql: "SELECT * FROM change_logs ORDER BY created_at DESC LIMIT ?",
    params: [limit],
  }) as Promise<ChangeLog[]>;
}

export async function getChangeLogsByLibrary(
  libraryPath: string,
  limit = 50,
): Promise<ChangeLog[]> {
  await serviceRegistry.ensureReady("dbService");
  return call("db.query", {
    sql: "SELECT * FROM change_logs WHERE file_path LIKE ? ORDER BY created_at DESC LIMIT ?",
    params: [libraryPath + "%", limit],
  }) as Promise<ChangeLog[]>;
}

// ── Excel ────────────────────────────────────────────────────

export async function parseExcel(
  filePath: string,
  libraryPath?: string,
): Promise<unknown> {
  await serviceRegistry.ensureReady("excel");
  return call("excel.parse", { file_path: filePath, library_path: libraryPath });
}

export async function listExcelRecords(
  filePath?: string,
): Promise<ExcelRecord[]> {
  await serviceRegistry.ensureReady("excel");
  return call("excel.listRecords", {
    file_path: filePath ?? null,
  }) as Promise<ExcelRecord[]>;
}

export async function extractExcelImages(
  filePath: string,
  libraryPath?: string,
): Promise<unknown> {
  await serviceRegistry.ensureReady("excel");
  return call("excel.extractImages", {
    file_path: filePath,
    library_path: libraryPath,
  });
}
