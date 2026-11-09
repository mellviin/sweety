import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const productionCsp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      react(),
      {
        name: "production-csp-meta",
        transformIndexHtml(html) {
          if (mode === "production") {
            return html.replace("__SWEETY_PRODUCTION_CSP__", productionCsp);
          }

          return html.replace(
            /<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/,
            "",
          );
        },
      },
    ],
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.js"],
      restoreMocks: true,
    },
    server: {
      proxy: {
        "/api": {
          target: env.VITE_API_PROXY_TARGET ?? "http://localhost:3000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
