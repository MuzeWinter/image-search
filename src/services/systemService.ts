import { open } from "@tauri-apps/plugin-shell";

export async function openFile(filePath: string): Promise<void> {
  await open(filePath);
}

export async function openFolder(folderPath: string): Promise<void> {
  await open(folderPath);
}
