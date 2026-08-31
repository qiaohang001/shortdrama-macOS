import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

// 把 workspace 包直接指向 packages/ 源码，避免 node_modules 里的旧拷贝导致改动不生效
const r = (p) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), p);

export default defineConfig({
  plugins: [react()],
  build: {
    // 沙箱 safe-delete 外壳会拦截 fs.rmSync 并超时，关闭自动清空，构建前手动移走旧 dist 即可
    emptyOutDir: false,
  },
  css: {
    preprocessorOptions: {
      scss: { api: "modern" },
    },
  },
  resolve: {
    alias: {
      "@dual/agnes-client": r("../../packages/agnes-client/src/index.js"),
      "@dual/ui": r("../../packages/ui/src/index.js"),
    },
  },
});
