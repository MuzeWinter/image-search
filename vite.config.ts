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
          const match = id.match(/\/pages\/(\w+)\.tsx$/);
          if (match) {
            return `page-${match[1].toLowerCase()}`;
          }
        },
      },
    },
  },
});
