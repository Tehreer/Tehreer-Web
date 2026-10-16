# Tehreer Web demo

A web demo of the `tehreer` package (Tehreer Core compiled to WebAssembly), built with Vite, React and
TypeScript. It follows the Tehreer-Web design and the screens of the Android demo, with the same
fonts and sample text.

| Screen | What it shows |
|--------|---------------|
| Overview | Links to every screen |
| Bidirectional Algorithm | Resolved runs, levels and visual order of mixed-direction text (`BidiAlgorithm` of SheenBidi) |
| Typeface Information | Names and metrics of a typeface, with a specimen |
| Typeface Glyphs | Every glyph of a typeface in a grid that the window scrolls and that draws only the rows in view; selecting one opens a dialog with its outline, advance and bounds, and previous/next buttons |
| OpenType Shaping | `ShapingEngine` output grouped by cluster, with a small image of each glyph next to its ID |
| Custom Label | Urdu article in a `TLabel` with an outline; the links open in a new tab |
| Custom Text View | The whole of Surah Al Kahf in a `TTextView`: justified, coloured, with selectable verses and adjustable size |
| Variable Fonts | Axes, instances and colour palettes of the variable fonts |

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type check + production build in dist/
```

The demo imports the library from `../src` (see the `tehreer` alias in `vite.config.ts`), so the
WebAssembly module has to be built first with `bash scripts/build-wasm.sh` in the parent directory.

Text is drawn by the `TLabel` and `TTextView` widgets, and the demo adds `LinkableLabel` and `QuranTextView` on top of them, as the Android demo does (each keeps its link or selected verse in state and gives the widget `highlights`, and the widget reports hover, press and tap) of `tehreer/react` (see `../src/react`); only the glyph
grid draws on a canvas itself (`src/lib/TehreerCanvas.tsx`).

## Known differences

  paragraph direction is applied with an invisible LRM or RLM mark in front of the text.

## Layout

The window is the only scroller, like a GitHub page: only the sidebar and the header of every page (also the Overview) are sticky; nothing else on a page sticks. The header publishes its height as `--header-height`, which "Go to glyph ID" uses to stop below it.
