import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";

// 把 workspace 包直接指向 packages/ 源码，避免 node_modules 里的旧拷贝导致改动不生效
const r = (p) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), p);

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/src-tauri/target/**', '**/node_modules/**'],
    },
  },
  build: {
    // 必须清空旧产物：之前关掉这项后，dist/assets 累积了上百个历史 chunk，
    // 打包时会全部塞进安装包。
    // 注：若在带有 safe-delete 拦截的沙箱里构建，fs.rmSync 可能超时，
    // 那种情况下先手动移走 dist 目录再 build。
    emptyOutDir: true,
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
