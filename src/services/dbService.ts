import { callBackend } from "./ipc";
import { serviceRegistry } from "./registry";
import type { SystemStats } from "./types";

serviceRegistry.register({
  name: "dbService",
  status: "idle",
  start: async () => {
    await callBackend("db.init");
  },
  invoke: <T>(method: string, params?: Record<string, unknown>) =>
    callBackend<T>(method, params),
});

export async function getStats(): Promise<SystemStats> {
  await serviceRegistry.ensureReady("dbService");
  return callBackend<SystemStats>("db.getStats");
}

export async function query<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  await serviceRegistry.ensureReady("dbService");
  return callBackend<T[]>("db.query", { sql, params: params ?? [] });
}

export async function execute(
  sql: string,
  params?: unknown[],
): Promise<{ changes: number; lastRowId: number | null }> {
  await serviceRegistry.ensureReady("dbService");
  return callBackend<{ changes: number; lastRowId: number | null }>(
    "db.execute",
    { sql, params: params ?? [] },
  );
}

export interface ActivityLog {
  id: number;
  level: "info" | "warn" | "error";
  source: string;
  message: string;
  created_at: string;
}

export async function getLogs(
  level?: string,
  limit?: number,
): Promise<ActivityLog[]> {
  await serviceRegistry.ensureReady("dbService");
  return callBackend<ActivityLog[]>("db.getLogs", {
    level: level ?? null,
    limit: limit ?? 50,
  });
}
