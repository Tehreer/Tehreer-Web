/*
 * Copyright (C) 2026 Muhammad Tayyab Akram
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import {
  Color, ComposedFrame, DrawStyle, FrameResolver, GlyphCache, Renderer, Replacement, ReplacementKind, TMutableText, Typesetter,
  type ReplacementBounds, type ReplacementDelegate,
} from "../src/index.js";
import { setImageSourceFactory } from "../src/drawing/CanvasPainter.js";
import { imageData, replacements } from "../src/internal/Callbacks.js";
import { NASTALIQ, ROBOTO, RecordingContext, loadFont, ready } from "./Support.js";

before(ready);

let made = 0;

before(() => {
  setImageSourceFactory((_rgba, width, height) => {
    made++;
    return { width, height };
  });
});

afterEach(() => GlyphCache.default.clear());

function setup(text: string | TMutableText, font = ROBOTO, size = 20) {
  const typeface = loadFont(font).typefaces.get(0);
  const resolver = new FrameResolver();
  resolver.typesetter = new Typesetter(text, { typeface, typeSize: size });
  resolver.frameWidth = 300;
  resolver.frameHeight = 300;
  const frame = resolver.createFrame(0, text.length);
  const renderer = new Renderer();
  renderer.typeface = typeface;
  renderer.typeSize = size;
  return { frame, renderer, typeface };
}

test("a frame draws the image of each glyph, which a canvas gets as images", () => {
  const { frame, renderer } = setup("abcabc");
  const context = new RecordingContext();
  frame.draw(renderer, context.asContext, 10, 20);

  const images = context.of("drawImage");
  assert.equal(images.length, 6);
  for (const [, x, y] of images as [string, number, number][]) {
    assert.ok(Number.isInteger(x) && Number.isInteger(y), "positions are whole pixels");
    assert.ok(x >= 10 - 2 && y >= 20 - 2 && y < 20 + 25);
  }
  const xs = (images as [string, number][]).map(([, x]) => x);
  assert.deepEqual([...xs].sort((a, b) => a - b), xs, "the glyphs go from left to right");
  assert.equal(context.count("fillRect"), 0);
});

test("the render scale multiplies what is drawn", () => {
  const { frame, renderer } = setup("abc");
  renderer.renderScale = 1;
  const normal = new RecordingContext();
  frame.draw(renderer, normal.asContext, 10, 20);
  renderer.renderScale = 2;
  const scaled = new RecordingContext();
  frame.draw(renderer, scaled.asContext, 10, 20);

  const last = (context: RecordingContext) => context.of("drawImage").at(-1) as [string, number, number];
  assert.ok(Math.abs(last(scaled)[1] - 2 * last(normal)[1]) <= 8, `${last(scaled)[1]} vs ${last(normal)[1]}`);
});

test("the images of glyphs are made once for each color", () => {
  const { frame, renderer } = setup("abab");
  made = 0;
  frame.draw(renderer, new RecordingContext().asContext, 0, 0);
  const first = made;
  assert.equal(first, 2, "a and b");
  frame.draw(renderer, new RecordingContext().asContext, 0, 0);
  assert.equal(made, first, "they are cached on the glyph images");

  renderer.foregroundColor = 0xffff0000;
  frame.draw(renderer, new RecordingContext().asContext, 0, 0);
  assert.equal(made, first * 2, "a color makes a new image of the same glyph");
});

test("what is cached on a glyph image goes when the image does", () => {
  const { frame, renderer } = setup("abc");
  const before = imageData.size;
  frame.draw(renderer, new RecordingContext().asContext, 0, 0);
  assert.ok(imageData.size > before);
  GlyphCache.default.clear();
  assert.equal(imageData.size, before);
});

test("backgrounds and decorations are rectangles in their colors", () => {
  const text = new TMutableText("abcdef");
  text.setAttributes(1, 3, { backgroundColor: 0xff00ff00 });
  text.setAttributes(3, 5, { underline: true, strikethrough: true, decorationColor: 0x80102030 });
  const { frame, renderer } = setup(text);
  const context = new RecordingContext();
  frame.draw(renderer, context.asContext, 0, 0);

  const fills = context.of("fillRect") as [string, number, number, number, number, string][];
  assert.ok(fills.some((fill) => fill[5] === "rgb(0, 255, 0)"), "the background");
  assert.equal(fills.filter((fill) => fill[5] === Color.toCss(0x80102030)).length, 2, "an underline and a strikethrough");
  assert.ok(fills.every((fill) => fill[3] > 0 && fill[4] > 0));
});

test("the foreground color of a run paints its glyphs", () => {
  const text = new TMutableText("abab");
  text.setAttributes(0, 2, { foregroundColor: 0xff0000ff });
  const { frame, renderer } = setup(text);
  made = 0;
  frame.draw(renderer, new RecordingContext().asContext, 0, 0);
  assert.equal(made, 4, "a and b in two colors");
});

test("a shadow wraps the glyphs of each run", () => {
  const { frame, renderer } = setup("abc");
  renderer.shadowRadius = 4;
  renderer.shadowDx = 2;
  renderer.shadowDy = 3;
  renderer.shadowColor = 0xff0000ff;
  const context = new RecordingContext();
  frame.draw(renderer, context.asContext, 0, 0);

  const calls = context.calls.map(([name]) => name);
  assert.equal(calls[0], "save");
  assert.equal(calls.at(-1), "restore");
  assert.equal(context.count("save"), context.count("restore"));
  assert.equal(context.shadowBlur, 4);
  assert.deepEqual([context.shadowOffsetX, context.shadowOffsetY], [2, 3]);
  assert.equal(context.shadowColor, "rgb(0, 0, 255)");
});

test("the draw style decides what is drawn", () => {
  const { frame, renderer } = setup("abc");
  renderer.drawStyle = DrawStyle.FillStroke;
  const both = new RecordingContext();
  frame.draw(renderer, both.asContext, 0, 0);
  assert.equal(both.count("drawImage"), 6);
  renderer.drawStyle = DrawStyle.Stroke;
  const stroke = new RecordingContext();
  frame.draw(renderer, stroke.asContext, 0, 0);
  assert.equal(stroke.count("drawImage"), 3);
});

test("lines and runs are drawn like the frame draws them", () => {
  const { frame, renderer } = setup("abc");
  const line = frame.lines.get(0);
  const viaFrame = new RecordingContext();
  frame.draw(renderer, viaFrame.asContext, 5, 7);
  const viaLine = new RecordingContext();
  line.draw(renderer, viaLine.asContext, 5, 7);
  assert.deepEqual(viaLine.calls, viaFrame.calls);

  const viaRun = new RecordingContext();
  line.runs.get(0).draw(renderer, viaRun.asContext, 5, 7 + line.origin.y);
  assert.deepEqual(viaRun.calls, viaFrame.calls);
});

test("right to left glyphs are drawn", () => {
  const { frame, renderer } = setup("تحریر ایک متنی انجن ہے", NASTALIQ, 30);
  const context = new RecordingContext();
  frame.draw(renderer, context.asContext, 0, 0);
  assert.ok(context.count("drawImage") >= 5);
});

test("a renderer that has no draw callbacks left does not call the context again", () => {
  const { frame, renderer } = setup("abc");
  const context = new RecordingContext();
  frame.draw(renderer, context.asContext, 0, 0);
  const calls = context.calls.length;
  renderer.getGlyphImage(renderer.typeface!.getGlyphId(0x61))!.dispose();
  assert.equal(context.calls.length, calls);
});

test("an error of a context is thrown from the draw call, and drawing works after it", () => {
  const { frame, renderer } = setup("abc");
  const broken = new RecordingContext();
  broken.drawImage = () => {
    throw new Error("canvas is lost");
  };
  assert.throws(() => frame.draw(renderer, broken.asContext, 0, 0), /canvas is lost/);

  const working = new RecordingContext();
  frame.draw(renderer, working.asContext, 0, 0);
  assert.equal(working.count("drawImage"), 3);
});

function replacementText(delegate: ReplacementDelegate, kind?: ReplacementKind) {
  const text = new TMutableText("a￼b");
  const replacement = new Replacement(delegate, kind);
  text.setAttributes(1, 2, { replacement });
  return { text, replacement };
}

test("a replacement takes room, and is drawn where it is", () => {
  const widths: number[] = [];
  const drawn: ReplacementBounds[] = [];
  const { text, replacement } = replacementText({
    computeRoom(layoutWidth) {
      widths.push(layoutWidth);
      return { ascent: 12, descent: 4, extent: 33 };
    },
    draw(_context, bounds) {
      drawn.push(bounds);
    },
  });
  const { frame, renderer } = setup(text);
  assert.ok(widths.length > 0 && widths.every((width) => width === 0 || width === 300));

  const run = frame.lines.get(0).runs.find((candidate) => candidate.replacement !== undefined)!;
  assert.ok(run.replacement!.equals(replacement));
  assert.equal(run.width, 33);
  assert.equal(run.ascent, 12);
  assert.equal(run.descent, 4);
  assert.equal(replacement.kind, ReplacementKind.Inline);
  assert.deepEqual(replacement.computeRoom(100), { ascent: 12, descent: 4, extent: 33 });

  renderer.renderScale = 2;
  frame.draw(renderer, new RecordingContext().asContext, 0, 0);
  assert.equal(drawn.length, 1);
  assert.equal(drawn[0]!.width, 66);
  assert.equal(drawn[0]!.ascent, 24);
  assert.equal(drawn[0]!.descent, 8);
  assert.ok(drawn[0]!.x > 0);
});

test("a block replacement has a line of its own", () => {
  const { text } = replacementText({ computeRoom: (layoutWidth) => ({ ascent: 10, descent: 0, extent: layoutWidth }) }, ReplacementKind.Block);
  const { frame } = setup(text);
  assert.equal(frame.lines.length, 3);
  assert.ok(frame.lines.get(1).isBlock);
  assert.equal(frame.lines.get(1).runs.get(0).width, 300);
});

test("an error of a delegate is thrown from the call that needed it", () => {
  const { text } = replacementText({
    computeRoom() {
      throw new Error("no room");
    },
  });
  assert.throws(() => new Typesetter(text, { typeface: loadFont(ROBOTO).typefaces.get(0), typeSize: 20 }), /no room/);

  const typeface = loadFont(ROBOTO).typefaces.get(0);
  const { text: other } = replacementText({ computeRoom: () => ({ ascent: 1, descent: 1, extent: 1 }), draw() {
    throw new Error("cannot draw");
  } });
  const resolver = new FrameResolver();
  resolver.typesetter = new Typesetter(other, { typeface, typeSize: 20 });
  const frame: ComposedFrame = resolver.createFrame(0, 3);
  const renderer = new Renderer();
  renderer.typeface = typeface;
  assert.throws(() => frame.draw(renderer, new RecordingContext().asContext, 0, 0), /cannot draw/);
});

test("the state of a replacement goes when Core is done with it", () => {
  const before = replacements.size;
  const { text, replacement } = replacementText({ computeRoom: () => ({ ascent: 1, descent: 1, extent: 1 }) });
  assert.equal(replacements.size, before + 1);
  replacement.dispose();
  assert.equal(replacements.size, before + 1, "the text still holds it");
  text.dispose();
  assert.equal(replacements.size, before);
});

test("toSvg draws the glyphs of a frame as outlines", () => {
  const { frame, renderer } = setup("abcabc");
  const svg = frame.toSvg(renderer, 10, 20);
  assert.match(svg, /^<g>.*<\/g>$/s);
  const paths = svg.match(/<path d="M[^"]+" transform="translate\(([\d.-]+) ([\d.-]+)\)" fill="#000000"\/>/g) ?? [];
  assert.equal(paths.length, 6);
  const xs = paths.map((path) => Number(/translate\(([\d.-]+)/.exec(path)![1]));
  assert.deepEqual([...xs].sort((a, b) => a - b), xs, "the glyphs go from left to right");
  assert.ok(xs[0]! >= 10 - 2);
});

test("toSvg strokes outlines with the stroke settings", () => {
  const { frame, renderer } = setup("ab");
  renderer.drawStyle = DrawStyle.FillStroke;
  renderer.strokeRadius = 1.5;
  renderer.strokeColor = 0x80ff0000;
  const svg = frame.toSvg(renderer, 0, 0);
  assert.equal((svg.match(/fill="#000000"/g) ?? []).length, 2);
  assert.equal((svg.match(/fill="none" stroke="#ff0000" stroke-opacity="0.502" stroke-width="3"/g) ?? []).length, 2);

  renderer.drawStyle = DrawStyle.Stroke;
  assert.equal((frame.toSvg(renderer, 0, 0).match(/<path/g) ?? []).length, 2);
});

test("toSvg draws backgrounds, decorations and shadows", () => {
  const text = new TMutableText("abcdef");
  text.setAttributes(1, 3, { backgroundColor: 0xff00ff00 });
  text.setAttributes(3, 5, { underline: true, foregroundColor: 0xff0000ff });
  const { frame, renderer } = setup(text);
  renderer.shadowRadius = 4;
  renderer.shadowDx = 2;
  renderer.shadowDy = 3;
  renderer.shadowColor = 0x800000ff;
  const svg = frame.toSvg(renderer, 0, 0);
  assert.match(svg, /<rect [^>]*fill="#00ff00"\/>/);
  assert.match(svg, /<rect [^>]*fill="#0000ff"\/>/, "the underline takes the foreground color");
  assert.match(svg, /<filter id="tehreer-shadow-\d+"[^>]*><feDropShadow dx="2" dy="3" stdDeviation="2" flood-color="#0000ff" flood-opacity="0.502"\/>/);
  assert.equal((svg.match(/<g filter=/g) ?? []).length, (svg.match(/<\/g>/g) ?? []).length - 1);
});

test("toSvg works for lines and runs, and leaves the renderer drawing images afterward", () => {
  const { frame, renderer } = setup("abc");
  const line = frame.lines.get(0);
  assert.equal((line.toSvg(renderer, 0, 0).match(/<path/g) ?? []).length, 3);
  assert.equal((line.runs.get(0).toSvg(renderer, 0, 0).match(/<path/g) ?? []).length, 3);
  const context = new RecordingContext();
  frame.draw(renderer, context.asContext, 0, 0);
  assert.equal(context.count("drawImage"), 3);
});

test("toSvg fails once the frame is disposed", () => {
  const { frame, renderer } = setup("abc");
  frame.dispose();
  assert.throws(() => frame.toSvg(renderer, 0, 0), /disposed/);
});
