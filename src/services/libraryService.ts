import { callBackend } from "./ipc";
import { serviceRegistry } from "./registry";
import type { Library } from "./types";

serviceRegistry.register({
  name: "libraryService",
  status: "idle",
  start: async () => {
    // Library service is stateless, no explicit init needed
  },
  invoke: <T>(method: string, params?: Record<string, unknown>) =>
    callBackend<T>(method, params),
});

export async function list(): Promise<Library[]> {
  await serviceRegistry.ensureReady("libraryService");
  return callBackend<Library[]>("library.list");
}

export async function add(path: string, label?: string): Promise<Library> {
  await serviceRegistry.ensureReady("libraryService");
  return callBackend<Library>("library.add", { path, label });
}

export async function remove(id: number): Promise<void> {
  await serviceRegistry.ensureReady("libraryService");
  await callBackend("library.remove", { id });
}

export async function get(id: number): Promise<Library> {
  await serviceRegistry.ensureReady("libraryService");
  return callBackend<Library>("library.get", { id });
}
