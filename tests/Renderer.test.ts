import assert from "node:assert/strict";
import { before, test } from "node:test";
import {
  Color, DrawStyle, GlyphCache, GlyphImageFormat, GlyphImageKind, Renderer, ShapingEngine, StrokeCap, StrokeJoin, WritingDirection,
} from "../src/index.js";
import { EMOJI, NASTALIQ, ROBOTO, RecordingContext, loadFont, ready } from "./Support.js";
import { setImageSourceFactory } from "../src/drawing/CanvasPainter.js";

before(ready);

function renderer(font = ROBOTO, typeSize = 40): Renderer {
  const created = new Renderer();
  created.typeface = loadFont(font).typefaces.get(0);
  created.typeSize = typeSize;
  return created;
}

test("a renderer has the defaults of Core", () => {
  const created = new Renderer();
  assert.equal(created.typeSize, 16);
  assert.equal(created.scaleX, 1);
  assert.equal(created.scaleY, 1);
  assert.equal(created.skewX, 0);
  assert.equal(created.renderScale, 1);
  assert.equal(created.writingDirection, WritingDirection.LeftToRight);
  assert.equal(created.foregroundColor, 0xff000000);
  assert.equal(created.strokeRadius, 0.5);
  assert.equal(created.strokeCap, StrokeCap.Butt);
  assert.equal(created.strokeJoin, StrokeJoin.Round);
  assert.equal(created.strokeMiter, 1);
  assert.equal(created.strokeColor, 0xff000000);
  assert.equal(created.drawStyle, DrawStyle.Fill);
  assert.equal(created.typeface, undefined);
  assert.ok(created.isRenderable, "a size of 16 takes pixels");
  created.typeSize = 0.1;
  assert.ok(!created.isRenderable);
});

test("every setting reads back what was set", () => {
  const created = renderer();
  created.scaleX = 1.5;
  created.scaleY = 0.5;
  created.skewX = -0.25;
  created.renderScale = 2;
  created.writingDirection = WritingDirection.RightToLeft;
  created.foregroundColor = 0x80123456;
  created.strokeRadius = 2;
  created.strokeCap = StrokeCap.Square;
  created.strokeJoin = StrokeJoin.Bevel;
  created.strokeMiter = 4;
  created.strokeColor = 0xff0000ff;
  created.shadowRadius = 3;
  created.shadowDx = 1;
  created.shadowDy = -1;
  created.shadowColor = 0x40000000;
  created.drawStyle = DrawStyle.FillStroke;

  assert.deepEqual(
    [created.scaleX, created.scaleY, created.skewX, created.renderScale, created.strokeRadius, created.strokeMiter],
    [1.5, 0.5, -0.25, 2, 2, 4],
  );
  assert.equal(created.writingDirection, WritingDirection.RightToLeft);
  assert.equal(created.foregroundColor, 0x80123456, "an alpha above 0x7f stays unsigned");
  assert.equal(created.strokeCap, StrokeCap.Square);
  assert.equal(created.strokeJoin, StrokeJoin.Bevel);
  assert.equal(created.strokeColor, 0xff0000ff);
  assert.deepEqual([created.shadowRadius, created.shadowDx, created.shadowDy, created.shadowColor], [3, 1, -1, 0x40000000]);
  assert.equal(created.drawStyle, DrawStyle.FillStroke);
  assert.ok(created.isRenderable);
  assert.ok(created.typeface!.equals(created.typeface!));
});

test("a renderer uses the default glyph cache until another is set", () => {
  const created = renderer();
  assert.ok(created.glyphCache.equals(GlyphCache.default));
  const cache = new GlyphCache(1 << 20);
  created.glyphCache = cache;
  assert.ok(created.glyphCache.equals(cache));
  assert.equal(cache.capacity, 1 << 20);
  cache.capacity = 2 << 20;
  assert.equal(cache.capacity, 2 << 20);

  const glyph = created.typeface!.getGlyphId(0x61);
  created.getGlyphImage(glyph)!.dispose();
  assert.ok(cache.size > 0);
  cache.clear();
  assert.equal(cache.size, 0);
});

test("the image of a glyph has pixels, and a space has none", () => {
  const created = renderer();
  const glyph = created.typeface!.getGlyphId(0x61);
  const image = created.getGlyphImage(glyph)!;
  assert.equal(image.format, GlyphImageFormat.Alpha);
  assert.ok(image.width > 10 && image.height > 10);
  assert.equal(image.pixels.length, image.width * image.height);
  assert.ok(image.pixels.some((value) => value > 0));
  assert.ok(image.top > 0, "a letter rises above the baseline");

  const rgba = image.toRgba(Color.rgb(10, 20, 30));
  assert.equal(rgba.length, image.width * image.height * 4);
  const lit = rgba.findIndex((value, index) => index % 4 === 3 && value > 0);
  assert.deepEqual([...rgba.subarray(lit - 3, lit)], [10, 20, 30]);

  assert.equal(created.getGlyphImage(0), undefined);
  const stroke = created.getStrokeImage(glyph)!;
  assert.ok(stroke.width >= image.width);
});

test("a bitmap font gives color images that are scaled", (t) => {
  // The font has one strike of 109 pixels, and only its images are made.
  const created = renderer(EMOJI, 109);
  const typeface = created.typeface!;
  const glyph = [...Array(typeface.glyphCount).keys()].find((id) => {
    const found = created.getGlyphImage(id);
    found?.dispose();
    return found !== undefined;
  });
  if (glyph === undefined) {
    // The images are PNGs, which FreeType reads with libpng. The module is built without it.
    t.skip("FreeType of the module has no PNG support");
    return;
  }
  const image = created.getGlyphImage(glyph)!;
  assert.equal(image.format, GlyphImageFormat.ARGB);
  assert.equal(image.pixels.length, image.width * image.height * 4);
  assert.equal(image.toRgba().length, image.pixels.length);

  const run = { glyphIds: [glyph], glyphOffsets: [{ x: 0, y: 0 }], glyphAdvances: [100] };
  created.typeSize = 218;
  const [placement] = created.getGlyphPlacements(GlyphImageKind.Fill, run);
  assert.ok(Math.abs(placement!.scaleX - 2) < 0.01 && Math.abs(placement!.scaleY - 2) < 0.01);
  assert.equal(placement!.image.width, image.width, "a bigger size finds the same image");
});

test("ink boxes and outlines", () => {
  const created = renderer();
  const glyph = created.typeface!.getGlyphId(0x61);
  const box = created.computeGlyphInkBox(glyph);
  assert.ok(box.width > 5 && box.height > 5, JSON.stringify(box));

  const shaper = new ShapingEngine();
  shaper.typeface = created.typeface;
  shaper.typeSize = 40;
  const run = shaper.shapeText("abc");
  const runBox = created.computeRunInkBox(run);
  assert.ok(runBox.width > box.width * 2);

  const path = created.getGlyphPath(glyph)!;
  assert.ok(!path.isEmpty);
  const all = created.generatePath(run);
  assert.ok(all.verbs.length > path.verbs.length * 2);
  assert.throws(() => created.computeRunInkBox({ glyphIds: [1, 2], glyphOffsets: [{ x: 0, y: 0 }], glyphAdvances: [1, 1] }), RangeError);
});

test("glyph placements follow the pen", () => {
  const created = renderer();
  const shaper = new ShapingEngine();
  shaper.typeface = created.typeface;
  shaper.typeSize = 40;
  const run = shaper.shapeText("abc");
  const placements = created.getGlyphPlacements(GlyphImageKind.Fill, run);
  assert.equal(placements.length, 3);
  assert.deepEqual(placements.map((p) => p.glyphIndex), [0, 1, 2]);
  assert.ok(placements[1]!.x > placements[0]!.x && placements[2]!.x > placements[1]!.x);
  assert.ok(placements.every((p) => p.scaleX === 1 && p.image.width > 0));
  placements.forEach((p) => p.image.dispose());
});

test("glyphs are drawn through a context", () => {
  setImageSourceFactory((_rgba, width, height) => ({ width, height }));
  try {
    const created = renderer();
    const shaper = new ShapingEngine();
    shaper.typeface = created.typeface;
    shaper.typeSize = 40;
    const run = shaper.shapeText("abc");

    const context = new RecordingContext();
    created.drawGlyphs(context.asContext, run);
    assert.equal(context.count("drawImage"), 3);

    created.drawStyle = DrawStyle.FillStroke;
    const both = new RecordingContext();
    created.drawGlyphs(both.asContext, run);
    assert.equal(both.count("drawImage"), 6);
  } finally {
    setImageSourceFactory(undefined);
  }
});

test("the shaped nastaliq text renders with its own font", () => {
  const created = renderer(NASTALIQ, 60);
  const shaper = new ShapingEngine();
  shaper.typeface = created.typeface;
  shaper.typeSize = 60;
  shaper.writingDirection = WritingDirection.RightToLeft;
  const run = shaper.shapeText("تحریر");
  assert.ok(created.computeRunInkBox(run).width > 20);
});
