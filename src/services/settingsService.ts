import { invoke } from "@tauri-apps/api/core";
import { serviceRegistry } from "./registry";

function call(method: string, params?: unknown) {
  return invoke("call_backend", {
    method,
    params: params ?? {},
  });
}

serviceRegistry.register({
  name: "settingsService",
  status: "idle",
  start: async () => {
    // Settings service depends on db being initialized first
    // Db init happens via dbService.start()
  },
  invoke: <T>(method: string, params?: unknown) => call(method, params) as Promise<T>,
});

export async function get(key: string): Promise<string | null> {
  await serviceRegistry.ensureReady("settingsService");
  return call("settings.get", { key }) as Promise<string | null>;
}

export async function getAll(): Promise<Record<string, string>> {
  await serviceRegistry.ensureReady("settingsService");
  return call("settings.getAll") as Promise<Record<string, string>>;
}

export async function set(key: string, value: string): Promise<void> {
  await serviceRegistry.ensureReady("settingsService");
  await call("settings.set", { key, value });
}

export async function remove(key: string): Promise<void> {
  await serviceRegistry.ensureReady("settingsService");
  await call("settings.delete", { key });
}

export async function backup(targetPath: string): Promise<{ ok: boolean; backup_path: string }> {
  await serviceRegistry.ensureReady("settingsService");
  return call("settings.backup", { target_path: targetPath }) as Promise<{ ok: boolean; backup_path: string }>;
}

export async function restore(sourcePath: string): Promise<{ ok: boolean; restored_from: string; old_backup: string }> {
  await serviceRegistry.ensureReady("settingsService");
  return call("settings.restore", { source_path: sourcePath }) as Promise<{ ok: boolean; restored_from: string; old_backup: string }>;
}

export async function rebuildIndex(): Promise<{ ok: boolean; deleted_vectors: number }> {
  await serviceRegistry.ensureReady("settingsService");
  return call("settings.rebuildIndex") as Promise<{ ok: boolean; deleted_vectors: number }>;
}

export async function clearCache(): Promise<{ ok: boolean; cleaned_files: number }> {
  await serviceRegistry.ensureReady("settingsService");
  return call("settings.clearCache") as Promise<{ ok: boolean; cleaned_files: number }>;
}
