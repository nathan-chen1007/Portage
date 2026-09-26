import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// The app calls /api/* and /health on its own origin; Vite forwards them to the backend.
// The backend port comes from API_PORT in ../backend/.env (default 8000), the same place
// backend/run.bat reads it, so the two can't drift apart.
function backendPort() {
  try {
    const env = readFileSync(new URL("../backend/.env", import.meta.url), "utf8");
    const m = env.match(/^API_PORT=(\d+)/m);
    if (m) return m[1];
  } catch {
    /* no backend/.env yet */
  }
  return "8000";
}

const target = `http://127.0.0.1:${backendPort()}`;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    strictPort: true,
    proxy: { "/api": target, "/health": target },
  },
  preview: { port: 3000, strictPort: true, proxy: { "/api": target, "/health": target } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.js"],
    css: false,
  },
});
