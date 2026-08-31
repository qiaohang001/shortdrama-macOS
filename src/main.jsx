import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { ErrorBoundary } from "@dual/ui";

// 禁用 F5 刷新（防止误触导致页面重新加载）
window.addEventListener("keydown", (e) => {
  if (e.key === "F5") {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
});

// 桌面端（Tauri）自动从本机 ~/.dualstudio/glm_key 读取智谱 GLM 文本后端 Key。
async function bootstrap() {
  try {
    const tauri = window.__TAURI__;
    if (tauri && tauri.core && tauri.core.invoke) {
      try {
        const zhipuKey = await tauri.core.invoke("read_zhipu_key");
        if (zhipuKey && !localStorage.getItem("ZHIPU_API_KEY")) {
          localStorage.setItem("ZHIPU_API_KEY", zhipuKey);
        }
      } catch (_) {}
    }
  } catch (e) {
    // 非桌面端或读取失败：回退到手动填写，忽略
  }
  createRoot(document.getElementById("root")).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

bootstrap();
