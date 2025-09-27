import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function toWebSocketUrl(httpUrl: string) {
  if (httpUrl.startsWith("https://")) {
    return httpUrl.replace(/^https/, "wss");
  }
  if (httpUrl.startsWith("http://")) {
    return httpUrl.replace(/^http/, "ws");
  }
  return httpUrl;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiUrl = (env.API_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const wsUrl = toWebSocketUrl(apiUrl);

  return {
    plugins: [react()],
    build: {
      outDir: "../../dist/client",
      emptyOutDir: true, // also necessary
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        "/api": {
          target: apiUrl,
          changeOrigin: true,
        },
        "/ws": {
          target: wsUrl,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
