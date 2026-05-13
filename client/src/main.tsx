import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

if (!window.location.hash) {
  window.location.hash = "#/";
}

// ─── Global safety nets ─────────────────────────────────────────────────────
// Catch unhandled promise rejections (e.g. fetch failures in event handlers)
// and runtime errors from non-React code (liquidGL, raf callbacks, etc.).
// Logging them keeps a paper trail without taking down the app.
window.addEventListener("unhandledrejection", (e) => {
  // eslint-disable-next-line no-console
  console.warn("[Cel] unhandled rejection:", e.reason);
});

window.addEventListener("error", (e) => {
  // Ignore ResizeObserver loop notifications — known benign Chromium warning.
  if (e.message && /ResizeObserver/.test(e.message)) {
    e.stopImmediatePropagation();
    return;
  }
  // eslint-disable-next-line no-console
  console.warn("[Cel] window error:", e.message, e.filename, e.lineno);
});
// ────────────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(<App />);
