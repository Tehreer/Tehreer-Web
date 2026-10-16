// tsc only emits TypeScript, so the module that Emscripten generated is copied next to the output.
// Usage: node scripts/copy-wasm.mjs [output directory, default dist/wasm]
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = resolve(root, process.argv[2] ?? "dist/wasm");
mkdirSync(output, { recursive: true });
for (const file of ["tehreer.js", "tehreer.wasm"]) {
  copyFileSync(join(root, "src/wasm", file), join(output, file));
}
