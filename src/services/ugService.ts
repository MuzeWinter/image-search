import { callTauri } from "./ipc";

export interface PrtFileMap {
  [dir: string]: string[];
}

/** Batch scan multiple directories for .prt files. Returns dir -> list of .prt paths. */
export async function findPrtFilesBatch(dirs: string[]): Promise<PrtFileMap> {
  const uniqueDirs = [...new Set(dirs.filter(Boolean))];
  if (uniqueDirs.length === 0) return {};
  return callTauri<PrtFileMap>("find_prt_files_batch", { dirs: uniqueDirs });
}
