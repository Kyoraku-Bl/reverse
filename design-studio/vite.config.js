import { defineConfig } from "vite";
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("/node_modules/fabric/")) return "canvas-engine";
          if (
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/scheduler/")
          )
            return "react-vendor";
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: { "/api": { target: "http://127.0.0.1:3001", changeOrigin: false } },
  },
});
