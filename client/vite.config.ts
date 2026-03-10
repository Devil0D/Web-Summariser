import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";

export default defineConfig({
  plugins: [react(), svgr()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      // 1. Listen for any request that starts with /api
      '/api': {
        // 2. Forward it to your backend server
        target: 'http://localhost:5000',
        changeOrigin: true,
        // 3. Rewrite the path to match your backend's structure
        // Example: /api/auth/login -> /websears/auth/login
        rewrite: (path) => path.replace(/^\/api/, '/websears'),
      }
    }
  }
});