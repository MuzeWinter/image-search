import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
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
