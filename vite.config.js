import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" — GitHub Pages의 하위 경로(/repo-name/)에서도 에셋 경로가 깨지지 않는다.
export default defineConfig({
  plugins: [react()],
  base: "./",
  server: { port: 5173, open: true },
});
