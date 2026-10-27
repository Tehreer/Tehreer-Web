# tehreer-mcp

MCP server (stdio) over Tehreer-Web: fonts, Unicode properties, shaping, layout, SVG rendering and the Unicode Bidirectional Algorithm.

Tools

- Fonts: `font_load` (local `path`, `url` or `base64`), `font_list`, `font_unload`, `font_inspect`, `font_instance` (variation axes, named styles, color palettes; equal requests share one typeface), `font_release` (frees an instance), `font_glyphs`, `font_outline`, `font_table`, `font_match`.
- Unicode: `unicode_char_info`, `unicode_script_runs`.
- Shaping: `shape_text` (glyphs, clusters, caret edges and ink box for one script and direction; OpenType features, language), `shaping_lookup` (language and script tags, default direction).
- Layout: `layout_text` (attributed text in a frame: wrapping, alignment, truncation, justification; lines, runs or glyphs; plus `queries` for selection rectangles, hit testing, caret distances, visual edges and line boxes), `layout_break_lines` (line-break suggestions without a frame).
- Rendering: `render_text` (the layout inputs drawn by Core as an SVG: outlines, backgrounds, decorations, strokes, shadows, optional debug guides; `renderScale`, `background`, `padding`, optional `outputPath` to write a .svg), `render_glyph` (one glyph with optional metric guides). Replacements and bitmap-only glyphs (color emoji) are not drawn.
- Bidi: `bidi_analyze`, `bidi_levels`, `bidi_visual_order` (all take `text` and `baseDirection`: `auto` | `auto-rtl` | `ltr` | `rtl`).

Fonts are the only state: `font_load` returns a `fontId` and a `typefaceId` per face, and the other tools take typeface ids. Every other call builds and disposes its own Core objects. All indices are UTF-16 code unit offsets, matching Tehreer-Web's API.

Limits and environment variables:

- A font may be at most 64 MB, checked before it is read or while it streams. Prefer `path` or `url` over `base64` for large fonts (base64 messages up to 100 MiB are accepted, but slowly).
- `TEHREER_MCP_FONT_DIRS` (colon separated) restricts `path` sources to those directories; `TEHREER_MCP_OUTPUT_DIRS` does the same for the `outputPath` of the render tools.
- `url` sources must be http or https and may not point to this machine or a private network unless `TEHREER_MCP_ALLOW_LOCAL_URLS=1`; downloads time out after 30 s (`TEHREER_MCP_FETCH_TIMEOUT_MS`).
- At most 64 fonts and 1024 typefaces are held; release instances you no longer need.

```sh
(cd .. && npm install && npm run build)   # builds the tehreer package (dist/ + wasm)
npm install && npm run build
npm test                                   # needs Tehreer-Core next to this repo (or TEHREER_CORE) for its test fonts
npm run smoke                              # calls a few tools once
```

Claude Desktop / Claude Code config:

```json
{ "mcpServers": { "tehreer": { "command": "node", "args": ["<path to Tehreer-Web>/mcp/build/server.js"] } } }
```
