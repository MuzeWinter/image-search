import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync } from "fs";
import { resolve } from "path";

function readAppVersion(): string {
  try {
    const configPath = resolve(__dirname, "src-tauri", "tauri.conf.json");
    const raw = readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    return config.version || "0.0.0";
  } catch {
    return "0.0.0";
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(readAppVersion()),
  },
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react-router-dom')) {
            return 'vendor-router';
          }
          if (id.includes('node_modules/@tauri-apps')) {
            return 'vendor-tauri';
          }
          if (id.includes('node_modules/jotai')) {
            return 'vendor-jotai';
          }
          if (id.includes('src/components/shared/')) {
            return 'chunk-shared';
          }
          const match = id.match(/\/pages\/(\w+)\.tsx$/);
          if (match) {
            return `page-${match[1].toLowerCase()}`;
          }
        },
      },
    },
  },
});
