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
import { SfntTag, ShapingEngine, ShapingOrder, WritingDirection } from "../src/index.js";
import { NASTALIQ, ROBOTO, ready, loadFont } from "./Support.js";

before(ready);

function engine(font: string, typeSize = 100): ShapingEngine {
  const shaper = new ShapingEngine();
  shaper.typeface = loadFont(font).typefaces.get(0);
  shaper.typeSize = typeSize;
  return shaper;
}

test("text is shaped into glyphs", () => {
  const shaper = engine(ROBOTO);
  const result = shaper.shapeText("abc");
  assert.equal(result.codeUnitCount, 3);
  assert.equal(result.glyphCount, 3);
  assert.equal(result.glyphIds.length, 3);
  assert.ok(result.glyphIds.every((id) => id !== 0));
  assert.equal(result.glyphOffsets.length, 3);
  assert.ok(result.glyphAdvances.every((advance) => advance > 0));
  assert.deepEqual([...result.clusterMap], [0, 1, 2]);
  assert.ok(!result.isBackward && !result.isRTL);

  const typeface = shaper.typeface!;
  assert.equal(result.glyphIds.get(0), typeface.getGlyphId(0x61));
  assert.ok(Math.abs(result.glyphAdvances.get(0) - typeface.getGlyphAdvance(result.glyphIds.get(0), 100)) < 0.01);
});

test("a range of the text can be shaped", () => {
  const result = engine(ROBOTO).shapeText("abcabc", 1, 3);
  assert.equal(result.codeUnitCount, 2);
  assert.throws(() => engine(ROBOTO).shapeText("abc", 2, 9), RangeError);
});

test("caret edges grow along the run", () => {
  const result = engine(ROBOTO).shapeText("abc");
  const edges = result.getCaretEdges();
  assert.equal(edges.length, 4);
  assert.equal(edges[0], 0);
  assert.ok(edges[1]! > 0 && edges[2]! > edges[1]! && edges[3]! > edges[2]!);
  assert.ok(Math.abs(edges[3]! - result.glyphAdvances.reduce((a, b) => a + b, 0)) < 0.01);

  const stops = result.getCaretEdges([true, false, true]);
  assert.equal(stops.length, 4);
  assert.throws(() => result.getCaretEdges([true]), RangeError);
});

test("right to left text is shaped backward", () => {
  const shaper = engine(NASTALIQ, 50);
  shaper.writingDirection = WritingDirection.RightToLeft;
  const forward = shaper.shapeText("تحریر");
  assert.ok(forward.isRTL && !forward.isBackward);

  // Right to left text in a left to right paragraph runs against the direction of its glyphs.
  shaper.shapingOrder = ShapingOrder.Backward;
  const result = shaper.shapeText("تحریر");
  assert.ok(result.isBackward);
  assert.ok(result.glyphCount >= 1);
  assert.equal(result.clusterMap.length, 5);
  assert.equal(shaper.writingDirection, WritingDirection.RightToLeft);
});

test("scripts, languages and features", () => {
  assert.equal(ShapingEngine.getScriptDefaultDirection(SfntTag.make("arab")), WritingDirection.RightToLeft);
  assert.equal(ShapingEngine.getScriptDefaultDirection(SfntTag.make("latn")), WritingDirection.LeftToRight);
  assert.equal(SfntTag.toString(ShapingEngine.getLanguageTag("ur")), "URD ");

  const shaper = engine(NASTALIQ);
  shaper.languageTag = ShapingEngine.getLanguageTag("ur");
  shaper.scriptTag = SfntTag.make("arab");
  shaper.openTypeFeatures = [{ tag: SfntTag.make("liga"), value: 0 }];
  assert.deepEqual(shaper.openTypeFeatures, [{ tag: SfntTag.make("liga"), value: 0 }]);
  assert.ok(shaper.shapeText("ایک").glyphCount > 0);
});

test("an engine reads its settings from Core", () => {
  const shaper = new ShapingEngine();
  assert.equal(shaper.typeface, undefined);
  assert.equal(shaper.typeSize, 16);
  assert.equal(SfntTag.toString(shaper.scriptTag), "DFLT");
  assert.equal(SfntTag.toString(shaper.languageTag), "dflt");
  assert.equal(shaper.writingDirection, WritingDirection.LeftToRight);
  assert.equal(shaper.shapingOrder, ShapingOrder.Forward);
  assert.equal(shaper.openTypeFeatures.length, 0);

  const typeface = loadFont(ROBOTO).typefaces.get(0);
  shaper.typeface = typeface;
  shaper.typeSize = 12.5;
  shaper.scriptTag = SfntTag.make("arab");
  shaper.languageTag = SfntTag.make("URD");
  shaper.shapingOrder = ShapingOrder.Backward;
  assert.ok(shaper.typeface!.equals(typeface));
  assert.equal(shaper.typeSize, 12.5);
  assert.equal(SfntTag.toString(shaper.scriptTag), "arab");
  assert.equal(SfntTag.toString(shaper.languageTag), "URD ");
  assert.equal(shaper.shapingOrder, ShapingOrder.Backward);

  shaper.openTypeFeatures = [{ tag: SfntTag.make("liga"), value: 1 }, { tag: SfntTag.make("kern"), value: 0 }];
  assert.equal(shaper.openTypeFeatures.length, 2);
  shaper.openTypeFeatures = [];
  assert.equal(shaper.openTypeFeatures.length, 0);
  shaper.typeface = undefined;
  assert.equal(shaper.typeface, undefined);
});

test("shaping without a typeface fails", () => {
  assert.throws(() => new ShapingEngine().shapeText("abc"), /shaping result/);
});

test("tags are made from and turned to strings", () => {
  assert.equal(SfntTag.make("URD"), SfntTag.make("URD "));
  assert.equal(SfntTag.make("head"), 0x68656164);
  assert.equal(SfntTag.toString(0x68656164), "head");
  assert.throws(() => SfntTag.make(""), RangeError);
  assert.throws(() => SfntTag.make("toolong"), RangeError);
  assert.throws(() => SfntTag.make("é"), RangeError);
});
