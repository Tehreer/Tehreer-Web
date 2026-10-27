# tehreer-mcp

MCP server (stdio) over Tehreer-Web: fonts, Unicode properties, shaping, layout, SVG rendering and the Unicode Bidirectional Algorithm.

Tools

- Fonts: `font_load` (local `path`, `url` or `base64`), `font_list`, `font_unload`, `font_inspect`, `font_instance` (variation axes, named styles, color palettes), `font_glyphs`, `font_outline`, `font_table`, `font_match`.
- Unicode: `unicode_char_info`, `unicode_script_runs`.
- Shaping: `shape_text` (glyphs, clusters, caret edges and ink box for one script and direction; OpenType features, language), `shaping_lookup` (language and script tags, default direction).
- Layout: `layout_text` (attributed text in a frame: wrapping, alignment, truncation, justification; lines, runs or glyphs; plus `queries` for selection rectangles, hit testing, caret distances, visual edges and line boxes), `layout_break_lines` (line-break suggestions without a frame).
- Rendering: `render_text` (the layout inputs drawn by Core as an SVG: outlines, backgrounds, decorations, strokes, shadows, optional debug guides; `renderScale`, `background`, `padding`, optional `outputPath` to write a .svg), `render_glyph` (one glyph with optional metric guides). Replacements and bitmap-only glyphs (color emoji) are not drawn.
- Bidi: `bidi_analyze`, `bidi_levels`, `bidi_visual_order` (all take `text` and `baseDirection`: `auto` | `auto-rtl` | `ltr` | `rtl`).

Fonts are the only state: `font_load` returns a `fontId` and a `typefaceId` per face, and the other tools take typeface ids. Every other call builds and disposes its own Core objects. All indices are UTF-16 code unit offsets, matching Tehreer-Web's API.

Set `TEHREER_MCP_FONT_DIRS` (colon separated) to restrict `path` sources to those directories.

```sh
(cd .. && npm install && npm run build)   # builds the tehreer package (dist/ + wasm)
npm install && npm run build
npm test                                   # needs Tehreer-Core next to this repo (or TEHREER_CORE) for its test fonts
npm run smoke                              # calls a few tools once
```

Claude Desktop / Claude Code config:

```json
{ "mcpServers": { "tehreer": { "command": "node", "args": ["/Users/mta/Learning/Tehreer-Web/mcp/build/server.js"] } } }
```
