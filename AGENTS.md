# AGENTS.md

`tehreer` (npm, ES modules, strict TypeScript 5.9): Tehreer Core (`../Tehreer-Core`, C) compiled to one WebAssembly module with Emscripten, plus a TypeScript API shaped like Tehreer-Android and Tehreer-Cocoa. React widgets (`TLabel`, `TTextView`) live in `src/react` and ship as `tehreer/react`.

For wrapper conventions, memory/struct rules, mapping tables and the Core-update workflow, read `.claude/skills/web-wrapper/SKILL.md` before changing anything under `src/` or `native/`.

## Layout

- `src/` library, one class per file (PascalCase), folders mirror Android packages: `collections graphics layout sfnt unicode drawing react`. `index.ts` is the public surface.
- `src/internal/` never public. `NativeFunctions.ts` and `src/unicode/enums.ts` are generated; `src/wasm/tehreer.{js,wasm}` are generated and git-ignored (`tehreer.d.ts` is hand-written).
- `native/` CMake + `Module.c` (`tw_version`, `tw_layout`); `exports.json` is generated.
- `scripts/` build-wasm, generate-bindings, generate-unicode-enums, copy-wasm.
- `tests/` `node:test` suites using Core's fonts via `tests/Support.ts`.
- `demo/` Vite React app (own `package.json`, deployed to Vercel by a manual workflow). `mcp/` stdio MCP server over the bidi API (own `package.json`, uses `tehreer` via `file:..`).

## Commands

```bash
npm run build:wasm   # needs Emscripten (brew install emscripten); fetches Core via CMake, or TEHREER_CORE=<path>
npm run typecheck    # library + tests
npm test             # builds tests, copies wasm, node --test
npm run build        # dist/
npm run dev --prefix demo
```

## Rules

- Core owns the logic; TypeScript only converts arguments, calls one `TR*` function through `Module`, converts the result. Missing rule or getter: add it to Core, then bridge it.
- Web-only code stays in TS: canvas painting, `Path` to `Path2D`, font `fetch`, disposal, React.
- Native objects extend `NativeObject` and own one Core reference; follow Core's retain/adopt rule. Read Core data lazily, don't cache it.
- No pointer arithmetic outside `internal/Struct(s).ts`; new C structs need `Structs.ts` + `tw_layout` entries.
- Text is UTF-16; indices are JS string indices. Ranges are `fromIndex`/`toIndex`.
- Imports end in `.js`; type-only imports use `import type`; no default exports.
- No new dependencies (library has none; dev deps are `typescript`, `@types/node`) without asking.
- Never edit generated files by hand; regenerate with `build:wasm`.
- Commits only when asked; tag `[lib]`, `[test]`, `[native]`, `[react]`, `[demo]`, `[build]`, `[ci]`, `[docs]`; stage files explicitly.
