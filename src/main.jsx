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

async function bootstrap() {
  createRoot(document.getElementById("root")).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

bootstrap();
