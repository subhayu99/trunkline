import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Use relative URLs so the build deploys cleanly on any path —
// `username.github.io`, `username.github.io/<repo>/`, Netlify, etc.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
});
