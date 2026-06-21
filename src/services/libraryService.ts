import { invoke } from "@tauri-apps/api/core";
import { serviceRegistry } from "./registry";
import type { Library } from "./types";

function call(method: string, params?: unknown) {
  return invoke("call_backend", {
    method,
    params: params ?? {},
  });
}

serviceRegistry.register({
  name: "libraryService",
  status: "idle",
  start: async () => {
    // Library service is stateless, no explicit init needed
  },
  invoke: <T>(method: string, params?: unknown) => call(method, params) as Promise<T>,
});

export async function list(): Promise<Library[]> {
  await serviceRegistry.ensureReady("libraryService");
  return call("library.list") as Promise<Library[]>;
}

export async function add(
  path: string,
  label?: string,
): Promise<Library> {
  await serviceRegistry.ensureReady("libraryService");
  return call("library.add", { path, label }) as Promise<Library>;
}

export async function remove(id: number): Promise<void> {
  await serviceRegistry.ensureReady("libraryService");
  await call("library.remove", { id });
}

export async function get(id: number): Promise<Library> {
  await serviceRegistry.ensureReady("libraryService");
  return call("library.get", { id }) as Promise<Library>;
}
