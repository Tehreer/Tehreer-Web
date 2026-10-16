import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const library = fileURLToPath(new URL("../src/index.ts", import.meta.url));
const widgets = fileURLToPath(new URL("../src/react/index.ts", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: { alias: [
      { find: "tehreer/react", replacement: widgets },
      { find: /^tehreer$/, replacement: library },
    ] },
  server: { fs: { allow: [".."] } },
  optimizeDeps: { exclude: ["tehreer"] },
  build: { target: "esnext" },
  esbuild: { target: "esnext" },
});
