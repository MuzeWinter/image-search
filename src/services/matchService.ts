import { callBackend } from "./ipc";
import { serviceRegistry } from "./registry";
import type { MatchRecord, MatchStats } from "./types";

serviceRegistry.register({
  name: "matchService",
  status: "idle",
  start: async () => {},
  invoke: <T>(method: string, params?: Record<string, unknown>) =>
    callBackend<T>(method, params),
});

export async function listByStatus(
  status: string,
  limit = 100,
  offset = 0,
): Promise<{ items: MatchRecord[]; total: number; limit: number; offset: number }> {
  await serviceRegistry.ensureReady("matchService");
  return callBackend<{
    items: MatchRecord[];
    total: number;
    limit: number;
    offset: number;
  }>("match.listByStatus", { status, limit, offset });
}

export async function listUnmatched(
  limit = 100,
  offset = 0,
): Promise<{ items: MatchRecord[]; total: number; limit: number; offset: number }> {
  await serviceRegistry.ensureReady("matchService");
  return callBackend<{
    items: MatchRecord[];
    total: number;
    limit: number;
    offset: number;
  }>("match.listUnmatched", { limit, offset });
}

export async function getStats(): Promise<MatchStats> {
  await serviceRegistry.ensureReady("matchService");
  return callBackend<MatchStats>("match.getStats");
}

export async function confirm(
  id: number,
): Promise<{ ok: boolean; id: number; status: string }> {
  await serviceRegistry.ensureReady("matchService");
  return callBackend<{ ok: boolean; id: number; status: string }>(
    "match.confirm",
    { id },
  );
}

export async function reject(
  id: number,
): Promise<{ ok: boolean; id: number; status: string }> {
  await serviceRegistry.ensureReady("matchService");
  return callBackend<{ ok: boolean; id: number; status: string }>(
    "match.reject",
    { id },
  );
}

export async function bind(params: {
  img_id: string;
  ex_id?: string;
  cad_id?: string;
  pdf_id?: string;
  method?: string;
  confidence?: string;
}): Promise<{ ok: boolean; id: number; status: string }> {
  await serviceRegistry.ensureReady("matchService");
  return callBackend<{ ok: boolean; id: number; status: string }>(
    "match.bind",
    params,
  );
}
