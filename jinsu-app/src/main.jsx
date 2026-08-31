import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { ErrorBoundary } from "@dual/ui";

// 桌面端（Tauri）自动从本机 ~/.agnes/api_key 注入 key；浏览器预览仍走手动填写。
async function bootstrap() {
  try {
    const tauri = window.__TAURI__;
    if (tauri && tauri.core && tauri.core.invoke) {
      try {
        const agnesKey = await tauri.core.invoke("read_agnes_key");
        if (agnesKey && !localStorage.getItem("AGNES_API_KEY")) {
          localStorage.setItem("AGNES_API_KEY", agnesKey);
        }
      } catch (_) {}
      // 智谱 GLM 文本后端 Key（封面图/视频仍走 Agnes）
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
