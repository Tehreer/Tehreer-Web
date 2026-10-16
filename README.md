# Tehreer for the web

Tehreer Core compiled to WebAssembly with Emscripten, and a TypeScript API over all of its public
headers, shaped like the ones of Tehreer-Android and Tehreer-Cocoa.

```ts
import { initialize, FontFile, Typesetter, FrameResolver, Renderer } from "tehreer";

await initialize();

using file = await FontFile.fromUrl("/fonts/Roboto.ttf");
const typeface = file.typefaces[0]!;

const resolver = new FrameResolver();
resolver.typesetter = new Typesetter("Hello, world", { typeface, typeSize: 24 });
resolver.frameWidth = 320;
resolver.frameHeight = 200;
const frame = resolver.createFrame(0, "Hello, world".length);

const renderer = new Renderer();
renderer.renderScale = devicePixelRatio; // the context is not scaled
frame.draw(renderer, canvas.getContext("2d")!, 0, 0);
```

## Layout

```
native/        CMake and exports.json (generated): Core + its dependencies as one module
scripts/       build-wasm.sh, generate-bindings.mjs, generate-unicode-enums.mjs, copy-wasm.mjs
src/
  graphics/    FontFile, Typeface, TypefaceManager, TypeFamily, Renderer, GlyphCache, GlyphImage, Path
  layout/      TText, TMutableText, Typesetter, FrameResolver, ComposedFrame/Line, GlyphRun, LineLocator, Replacement
  sfnt/        ShapingEngine, ShapingResult, FontFeatures, SfntTag
  unicode/     BidiAlgorithm, BidiParagraph, BidiLine, BidiRun, BidiPair, ScriptClassifier, ScriptRun, CodePoint,
               BidiClass/GeneralCategory/Script (SheenBidi, as in Tehreer-Android; enums.ts is generated)
  drawing/     DrawingContext, CanvasPainter (what Core's draw callbacks do to a 2D context)
  collections/ List (what the lists of Core are), CoreList, CoreView
  internal/    Module, Memory, Struct/Structs (layouts of the C structs), Callbacks, NativeFunctions.ts (generated)
  wasm/        tehreer.js, tehreer.wasm (generated, git-ignored)
tests/         node:test suites; they use the fixture fonts of Tehreer-Core/Tests/Fonts
```

## Build and test

```bash
brew install emscripten                  # once
bash scripts/build-wasm.sh               # needs ../Tehreer-Core with a configured build/_deps
npm install
npm test                                 # compiles tests, runs them with node --test
npm run build                            # dist/ (JavaScript, declarations and the module)
```

`TEHREER_CORE` and `TR_DEPS_SRC` change where Core and its dependency sources come from.
`scripts/generate-bindings.mjs` reads `Headers/Tehreer/*.h` and writes the list of exported
functions and their declarations, so a change of the public API shows up as a type error here.

## Conventions

- **Initialize first.** `await initialize()` loads the module once; everything else throws before it.
- **Ownership.** Every wrapper owns one reference of Core and has `dispose()` (and `using`).
  A finalizer is only a safety net. Whenever Core hands out a reference that it does not retain
  for the caller, the wrapper retains its own, so a child never depends on its parent staying alive.
- **Names follow the other wrappers.** `startIndex`/`endIndex` for properties, `fromIndex`/`toIndex`
  for range parameters (never `TRRange`), `typeSize`, `strokeRadius`, `computeInkBox`, `isScalable`,
  `TText`/`TMutableText` (`Text` is a DOM class). Defaults are the ones of Core.
- **Indices are UTF-16 code units**, the indices of a JavaScript string. Invalid ranges throw `RangeError`;
  results that Core reports as "none" are `undefined`, or `-1` for an index.
- **Colors** are unsigned `0xAARRGGBB` numbers (`Color.argb()`, `Color.parse()`, `Color.toCss()`).
- **Nothing is cached from Core.** Properties read the memory of the module when they are read.
  Collections (`GlyphRun.glyphIds`, `Typeface.variationAxes`, `ComposedLine.runs`, …) are read-only
  `List`s, as in Android and Cocoa: they read the buffers of Core when an element is asked for, and
  they stop working when their owner is disposed. `toTypedArray()` copies a list of numbers in one go,
  and a renderer takes the lists of a run as they are, without a copy.
- **Structs of C are described once** in `internal/Structs.ts` with their names (`TRRect`, `TRVariationAxis`, …),
  and are read through views (`TRRect.view(address).width`) or written with `assign()`. A test
  compares every layout with the sizes and offsets that the compiler made (`tw_layout` in
  `native/Module.c`), so there is no pointer arithmetic outside of them.
- **`Module`** is the loaded WebAssembly module, an ES module binding that is usable in every file as
  soon as `initialize()` is done, and throws a clear error before that.
- **Enumerations** with callbacks in C return arrays here (`getSelectionRects`, `getVisualEdges`, `findLines`).
- **Errors thrown by your code** (a replacement delegate, a context) pass through Core and are thrown
  from the call that caused them.
- **Drawing** goes into a `CanvasRenderingContext2D` or an `OffscreenCanvasRenderingContext2D`. Core
  multiplies positions by `renderer.renderScale`, then the transform of the context applies.

## Not included yet

- `TRTextGetSheenBidiText` (the experimental text API of SheenBidi on a `TText`). The `unicode` package wraps the
  classic API of SheenBidi, the same classes as Tehreer-Android.
- Parsers of SFNT tables (`head`, `hhea`, `maxp`, `name`, `OS/2`, `post`); `Typeface.getTableData()` is there.
- FreeType is built without libpng, so bitmap fonts with PNG glyphs (`CBDT`) have no images.
  Color fonts with outlines (`COLR`) work.
- Fonts come from bytes (`new FontFile(bytes)`, `FontFile.fromUrl()`); the module has no file system.
