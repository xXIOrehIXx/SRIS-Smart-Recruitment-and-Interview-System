import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// Backend mặc định dev (theo Hosts/GP35.SRIS/Properties/launchSettings.json):
//   profile "http"      -> http://localhost:5082
//   profile "https"     -> http://localhost:5082 / https://localhost:7048
// Có thể override bằng VITE_API_TARGET hoặc VITE_APP_API_URL trong .env.
const API_TARGET = process.env.VITE_API_TARGET || "http://localhost:5082";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [react(), tailwindcss()],
  // Vài file .js còn chứa JSX (test + di sản) — dạy esbuild parse JSX trong .js.
  esbuild: { loader: "jsx", include: /src\/.*\.(js|jsx)$/ },
  optimizeDeps: {
    esbuildOptions: { loader: { ".js": "jsx" } },
  },
  // Giữ outDir "build" như CRA cũ — script deploy/tài liệu không phải đổi.
  build: { outDir: "build" },
  server: {
    proxy: {
      // FE gọi /api/... -> proxy sang BE (giữ Host/header, không rewrite path).
      // Bỏ qua WebSocket/Swagger nếu cần thì tinh chỉnh ở đây.
      "/api": {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  // Vitest (thay Jest của react-scripts)
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.js",
    css: false,
  },
});
