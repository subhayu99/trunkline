import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Deploys at the apex of trunkline.subhayu.in (custom domain via CNAME),
// so absolute "/" base path is correct.
export default defineConfig({
  base: "/",
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
  },
});
