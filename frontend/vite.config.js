import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The gateway URL is injected at build/run time via VITE_GATEWAY_URL
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 3000 },
  preview: { host: true, port: 3000 },
});
