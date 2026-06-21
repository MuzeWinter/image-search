import { invoke } from "@tauri-apps/api/core";

/** Typed wrapper for the generic "call_backend" IPC command. */
export async function callBackend<T>(
  method: string,
  params?: Record<string, unknown>,
): Promise<T> {
  return invoke("call_backend", {
    method,
    params: params ?? {},
  }) as Promise<T>;
}

/** Typed wrapper for direct Tauri command invocations (non-call_backend). */
export async function callTauri<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return invoke(cmd, args ?? {}) as Promise<T>;
}
