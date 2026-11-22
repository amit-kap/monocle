import React from "react";
import ReactDOM from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { applyTheme, getStoredTheme } from "./lib/theme";
import "./styles.css";

// In a plain browser (dev only), answer Tauri's calls from the demo folder.
if (import.meta.env.DEV && !isTauri()) {
  const { installBrowserMock } = await import("./dev/browserMock");
  installBrowserMock();
}

applyTheme(getStoredTheme());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
