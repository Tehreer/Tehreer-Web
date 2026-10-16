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
import { before, test } from "node:test";
import { SfntTag, TypeSlope, TypeWeight, TypeWidth } from "../src/index.js";
import { EMOJI, NASTALIQ, ROBOTO, ROBOTO_HIDDEN, ROBOTO_NAMES, ROBOTO_VARIABLE, ROCHER_COLOR, loadFont, ready } from "./Support.js";

before(ready);

test("a font file gives its typefaces, which outlive it", () => {
  const file = loadFont(ROBOTO);
  const typefaces = file.typefaces;
  assert.equal(typefaces.length, 1);
  const typeface = typefaces.get(0);
  file.dispose();
  assert.ok(file.isDisposed);
  assert.equal(typeface.familyName, "Roboto");
});

test("an unusable font is refused", async () => {
  const { FontFile } = await import("../src/index.js");
  assert.throws(() => new FontFile(new Uint8Array([1, 2, 3, 4])), /font file/);
});

test("the metrics and the names of a typeface", () => {
  const typeface = loadFont(ROBOTO).typefaces.get(0);
  assert.equal(typeface.styleName, "Regular");
  assert.equal(typeface.fullName, "Roboto Regular");
  assert.equal(typeface.weight, TypeWeight.Regular);
  assert.equal(typeface.width, TypeWidth.Normal);
  assert.equal(typeface.slope, TypeSlope.Plain);
  assert.equal(typeface.unitsPerEm, 2048);
  assert.ok(typeface.ascent > 0 && typeface.descent > 0);
  assert.ok(typeface.isScalable);
  assert.ok(!typeface.isVariable);
  assert.equal(typeface.glyphCount, 4);
  assert.ok(typeface.underlineThickness > 0);
});

test("a struct that Core returns is read from the right place", () => {
  const box = loadFont(ROBOTO).typefaces.get(0).boundingBox;
  assert.ok(box.width > 0 && box.height > 0, JSON.stringify(box));
  assert.ok(box.x < 0 + box.width && Number.isFinite(box.y));
});

test("glyphs, advances and outlines", () => {
  const typeface = loadFont(ROBOTO).typefaces.get(0);
  const glyph = typeface.getGlyphId("a".codePointAt(0)!);
  assert.notEqual(glyph, 0);
  assert.equal(typeface.getGlyphId("z".codePointAt(0)!), 0);
  assert.ok(typeface.getGlyphAdvance(glyph, 100) > 0);

  const path = typeface.getGlyphPath(glyph, 100)!;
  assert.ok(path.verbs.length > 4);
  assert.ok(path.toSvgPathData().startsWith("M"));
  const moved = path.transformed({ a: 1, b: 0, c: 0, d: 1, tx: 10, ty: 20 });
  assert.equal(moved.coordinates[0], path.coordinates[0]! + 10);
  assert.equal(moved.coordinates[1], path.coordinates[1]! + 20);
  assert.equal(typeface.getGlyphPath(glyph, 0), undefined);
});

test("glyph names and table data", () => {
  const typeface = loadFont(ROBOTO_NAMES).typefaces.get(0);
  assert.equal(typeface.getGlyphName(typeface.getGlyphId(0x61)), "a");
  assert.equal(typeface.getGlyphName(999), undefined);

  const head = SfntTag.make("head");
  const size = typeface.getTableSize(head);
  assert.equal(size, 54);
  const data = typeface.getTableData(head)!;
  assert.equal(data.length, size);
  // The magic number of the head table is at offset 12.
  assert.deepEqual([...data.subarray(12, 16)], [0x5f, 0x0f, 0x3c, 0xf5]);
  assert.deepEqual([...typeface.getTableData(head, 12, 4)!], [0x5f, 0x0f, 0x3c, 0xf5]);
  assert.equal(typeface.getTableData(SfntTag.make("zzzz")), undefined);
});

test("a variable font has axes, named styles and instances", () => {
  const typeface = loadFont(ROBOTO_VARIABLE).typefaces.get(0);
  assert.ok(typeface.isVariable);
  const axes = typeface.variationAxes;
  assert.deepEqual(axes.map((axis) => SfntTag.toString(axis.tag)), ["wght", "wdth"]);
  assert.ok(axes.get(0).minValue < axes.get(0).defaultValue && axes.get(0).defaultValue < axes.get(0).maxValue);
  assert.ok(!axes.get(0).isHidden);
  assert.equal(typeface.variationCoordinates.length, 2);

  assert.equal(loadFont(ROBOTO_HIDDEN).typefaces.get(0).variationAxes.get(0).isHidden, true);

  const styles = typeface.namedStyles;
  assert.equal(styles.length, 18);
  assert.ok(styles.every((style) => style.coordinates.length === 2));
  assert.ok(styles.some((style) => style.styleName === "Bold"));

  const bold = typeface.getVariationInstance([700, 100])!;
  assert.deepEqual(bold.variationCoordinates.toArray(), [700, 100]);
  assert.equal(bold.weight, 700);
  assert.equal(loadFont(ROBOTO).typefaces.get(0).getVariationInstance([1]), undefined);
});

test("a color font has palettes and colors", () => {
  const typeface = loadFont(ROCHER_COLOR).typefaces.get(0);
  assert.equal(typeface.predefinedPalettes.length, 11);
  assert.equal(typeface.paletteEntryNames.length, 4);
  assert.ok(typeface.predefinedPalettes.every((palette) => palette.colors.length === 4));
  assert.equal(typeface.associatedColors.length, 4);

  const red = 0xffff0000;
  const instance = typeface.getColorInstance([red, red, red, red])!;
  assert.deepEqual([...instance.associatedColors], [red, red, red, red]);
  assert.equal(loadFont(ROBOTO).typefaces.get(0).getColorInstance([red]), undefined);
});

test("a bitmap font is not scalable and has strikes", () => {
  const typeface = loadFont(EMOJI).typefaces.get(0);
  assert.ok(!typeface.isScalable);
  assert.equal(typeface.bitmapStrikes.length, 1);
  assert.equal(typeface.bitmapStrikes.get(0).pixelWidth, 109);
});

test("typefaces compare by their object of Core", () => {
  const file = loadFont(NASTALIQ);
  assert.ok(file.typefaces.get(0).equals(file.typefaces.get(0)));
  assert.ok(!file.typefaces.get(0).equals(loadFont(NASTALIQ).typefaces.get(0)));
});

test("using a disposed object fails with a clear message", () => {
  const typeface = loadFont(ROBOTO).typefaces.get(0);
  typeface.dispose();
  typeface.dispose();
  assert.throws(() => typeface.weight, /already disposed/);
});
