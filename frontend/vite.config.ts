import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // `npm run dev` : les appels /api passent par le WAF de la stack locale
    proxy: {
      "/api": { target: "https://localhost", changeOrigin: true, secure: false },
    },
  },
});
