import { callBackend } from "./ipc";
import { serviceRegistry } from "./registry";

serviceRegistry.register({
  name: "settingsService",
  status: "idle",
  start: async () => {
    // Settings service depends on db being initialized first
  },
  invoke: <T>(method: string, params?: Record<string, unknown>) =>
    callBackend<T>(method, params),
});

export async function get(key: string): Promise<string | null> {
  await serviceRegistry.ensureReady("settingsService");
  return callBackend<string | null>("settings.get", { key });
}

export async function getAll(): Promise<Record<string, string>> {
  await serviceRegistry.ensureReady("settingsService");
  return callBackend<Record<string, string>>("settings.getAll");
}

export async function set(key: string, value: string): Promise<void> {
  await serviceRegistry.ensureReady("settingsService");
  await callBackend("settings.set", { key, value });
}

export async function remove(key: string): Promise<void> {
  await serviceRegistry.ensureReady("settingsService");
  await callBackend("settings.delete", { key });
}

export async function backup(
  targetPath: string,
): Promise<{ ok: boolean; backup_path: string }> {
  await serviceRegistry.ensureReady("settingsService");
  return callBackend<{ ok: boolean; backup_path: string }>(
    "settings.backup",
    { target_path: targetPath },
  );
}

export async function restore(
  sourcePath: string,
): Promise<{ ok: boolean; restored_from: string; old_backup: string }> {
  await serviceRegistry.ensureReady("settingsService");
  return callBackend<{
    ok: boolean;
    restored_from: string;
    old_backup: string;
  }>("settings.restore", { source_path: sourcePath });
}

export async function rebuildIndex(): Promise<{
  ok: boolean;
  deleted_vectors: number;
}> {
  await serviceRegistry.ensureReady("settingsService");
  return callBackend<{ ok: boolean; deleted_vectors: number }>(
    "settings.rebuildIndex",
  );
}

export async function clearCache(): Promise<{
  ok: boolean;
  cleaned_files: number;
}> {
  await serviceRegistry.ensureReady("settingsService");
  return callBackend<{ ok: boolean; cleaned_files: number }>(
    "settings.clearCache",
  );
}
