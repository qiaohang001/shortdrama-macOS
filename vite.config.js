import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

const r = (p) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), p);

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/src-tauri/target/**', '**/node_modules/**'],
    },
  },
  build: {
    emptyOutDir: true,
  },
  css: {
    preprocessorOptions: {
      scss: { api: "modern" },
    },
  },
  resolve: {
    alias: {
      "@dual/agnes-client": r("./local-packages/agnes-client/src/index.js"),
      "@dual/ui": r("./local-packages/ui/src/index.js"),
    },
  },
});