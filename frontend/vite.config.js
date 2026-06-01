import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite dev server settings
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forward /api requests to the Express backend during development
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
