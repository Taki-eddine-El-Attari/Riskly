import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Autorise l'accès via un domaine de tunnel (ngrok) en plus de localhost.
    allowedHosts: true,
    // Proxy same-origin : le front appelle "/api/..." (VITE_API_URL vide),
    // Vite relaie vers le backend local. Évite CORS et mixed-content derrière ngrok.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
