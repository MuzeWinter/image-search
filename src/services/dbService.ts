import { invoke } from "@tauri-apps/api/core";
import { serviceRegistry } from "./registry";
import type { SystemStats } from "./types";

function call(method: string, params?: unknown) {
  return invoke("call_backend", {
    method,
    params: params ?? {},
  });
}

serviceRegistry.register({
  name: "dbService",
  status: "idle",
  start: async () => {
    await call("db.init");
  },
  invoke: <T>(method: string, params?: unknown) => call(method, params) as Promise<T>,
});

export async function getStats(): Promise<SystemStats> {
  await serviceRegistry.ensureReady("dbService");
  return call("db.getStats") as Promise<SystemStats>;
}

export async function query<T = unknown>(
  sql: string,
  params?: unknown[],
): Promise<T[]> {
  await serviceRegistry.ensureReady("dbService");
  return call("db.query", { sql, params: params ?? [] }) as Promise<T[]>;
}

export async function execute(
  sql: string,
  params?: unknown[],
): Promise<{ changes: number; lastRowId: number | null }> {
  await serviceRegistry.ensureReady("dbService");
  return call("db.execute", { sql, params: params ?? [] }) as Promise<{
    changes: number;
    lastRowId: number | null;
  }>;
}
