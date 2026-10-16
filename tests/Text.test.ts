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
import { FontFeatures, Replacement, SfntTag, TMutableText, TText, TextAlignment } from "../src/index.js";
import { ROBOTO, loadFont, ready } from "./Support.js";

before(ready);

test("a text keeps its string", () => {
  const text = new TText("abc");
  assert.equal(text.length, 3);
  assert.equal(text.string, "abc");
  assert.equal(text.getString(1, 3), "bc");
  assert.equal(text.getString(2, 2), "");
  assert.equal(`${text}`, "abc");
  assert.throws(() => text.getString(2, 4), RangeError);
  assert.throws(() => text.getString(2, 1), RangeError);
  assert.equal(new TText("").length, 0);
});

test("indices are code units, as those of a JavaScript string", () => {
  const text = new TText("a😀ب");
  assert.equal(text.length, 4);
  assert.equal(text.string, "a😀ب");
  assert.equal(text.getString(1, 3), "😀");
});

test("a text can be edited", () => {
  const text = new TMutableText("hello");
  text.append(" world");
  text.insert(5, ",");
  assert.equal(text.string, "hello, world");
  text.delete(5, 6);
  text.replace(0, 5, "HELLO");
  assert.equal(text.string, "HELLO world");
  text.setString("again");
  assert.equal(text.string, "again");
  assert.throws(() => text.insert(9, "x"), RangeError);
  assert.throws(() => text.delete(3, 9), RangeError);
  assert.throws(() => text.replace(4, 2, "x"), RangeError);
});

test("edits can be batched", () => {
  const text = new TMutableText();
  text.edit((editing) => {
    editing.append("a");
    editing.append("b");
  });
  assert.equal(text.string, "ab");
  assert.throws(
    () => text.edit(() => {
      throw new Error("boom");
    }),
    /boom/,
  );
  text.append("c");
  assert.equal(text.string, "abc");
});

test("copies are independent", () => {
  const mutable = new TMutableText("abc");
  const copy = mutable.copy();
  const again = copy.mutableCopy();
  mutable.append("d");
  again.append("e");
  assert.equal(copy.string, "abc");
  assert.equal(again.string, "abce");
  assert.ok(again instanceof TMutableText);
});

test("attributes are set on ranges, and come back as runs", () => {
  const typeface = loadFont(ROBOTO).typefaces.get(0);
  const text = new TMutableText("abcde");
  text.setAttributes(0, 3, { typeSize: 20, typeface });
  text.setAttributes(2, 5, { foregroundColor: 0xff112233 });

  const first = text.getAttributeRun(0)!;
  assert.equal(first.length, 2);
  assert.equal(first.attributes.typeSize, 20);
  assert.ok(first.attributes.typeface!.equals(typeface));
  assert.equal(first.attributes.foregroundColor, undefined);

  const second = text.getAttributeRun(2)!;
  assert.equal(second.length, 1);
  assert.equal(second.attributes.typeSize, 20);
  assert.equal(second.attributes.foregroundColor, 0xff112233);

  const third = text.getAttributeRun(3)!;
  assert.equal(third.length, 2);
  assert.equal(third.attributes.typeSize, undefined);
  assert.equal(third.attributes.foregroundColor, 0xff112233);

  assert.equal(text.getAttributeRun(5), undefined);
  assert.throws(() => text.setAttributes(0, 9, { typeSize: 1 }), RangeError);
});

test("every kind of attribute is stored and read back", () => {
  const text = new TMutableText("abc");
  const replacement = new Replacement({ computeRoom: () => ({ ascent: 1, descent: 1, extent: 1 }) });
  text.setAttributes(0, 3, {
    typeSize: 12.5,
    scaleX: 1.5,
    scaleY: 0.5,
    baselineOffset: 2,
    obliqueness: -0.25,
    replacement,
    foregroundColor: 0x80ff0000,
    backgroundColor: 0xff00ff00,
    underline: true,
    strikethrough: false,
    decorationColor: 0xff0000ff,
    userData: 4242,
    languageTag: SfntTag.make("URD"),
    fontFeatures: [{ tag: SfntTag.make("liga"), value: 0 }],
    textAlignment: TextAlignment.Center,
    firstLineHeadIndent: 10,
    headIndent: 8,
    tailIndent: -4,
    firstIndentLineCount: 2,
    paragraphSpacingBefore: 3,
    paragraphSpacing: 5,
    lineHeightMultiple: 1.25,
    minimumLineHeight: 14,
    maximumLineHeight: 40,
    lineSpacing: 2,
  });

  const { attributes, length } = text.getAttributeRun(0)!;
  assert.equal(length, 3);
  assert.deepEqual(
    [attributes.typeSize, attributes.scaleX, attributes.scaleY, attributes.baselineOffset, attributes.obliqueness],
    [12.5, 1.5, 0.5, 2, -0.25],
  );
  assert.ok((attributes.replacement as Replacement).equals(replacement));
  assert.equal(attributes.foregroundColor, 0x80ff0000);
  assert.equal(attributes.backgroundColor, 0xff00ff00);
  assert.equal(attributes.underline, true);
  assert.equal(attributes.strikethrough, false);
  assert.equal(attributes.decorationColor, 0xff0000ff);
  assert.equal(attributes.userData, 4242);
  assert.equal(attributes.languageTag, SfntTag.make("URD"));
  assert.deepEqual((attributes.fontFeatures as FontFeatures).items.toArray(), [{ tag: SfntTag.make("liga"), value: 0 }]);
  assert.equal(attributes.textAlignment, TextAlignment.Center);
  assert.deepEqual(
    [
      attributes.firstLineHeadIndent, attributes.headIndent, attributes.tailIndent, attributes.firstIndentLineCount,
      attributes.paragraphSpacingBefore, attributes.paragraphSpacing, attributes.lineHeightMultiple,
      attributes.minimumLineHeight, attributes.maximumLineHeight, attributes.lineSpacing,
    ],
    [10, 8, -4, 2, 3, 5, 1.25, 14, 40, 2],
  );
});

test("attributes are removed from ranges", () => {
  const text = new TMutableText("abcd");
  text.setAttributes(0, 4, { typeSize: 10, underline: true });
  text.removeAttributes(1, 3, "typeSize", "underline");

  assert.equal(text.getAttributeRun(0)!.length, 1);
  const middle = text.getAttributeRun(1)!;
  assert.equal(middle.length, 2);
  assert.deepEqual(middle.attributes, {});
  assert.equal(text.getAttributeRun(3)!.attributes.typeSize, 10);
});

test("replaced text takes the attributes of what it replaces", () => {
  const text = new TMutableText("abcd");
  text.setAttributes(0, 4, { typeSize: 10 });
  text.replace(1, 3, "XYZ");
  assert.equal(text.string, "aXYZd");
  const run = text.getAttributeRun(0)!;
  assert.equal(run.length, 5);
  assert.equal(run.attributes.typeSize, 10);
});

test("font features are a native object too", () => {
  const features = new FontFeatures([
    { tag: SfntTag.make("liga"), value: 1 },
    { tag: SfntTag.make("kern"), value: 0 },
  ]);
  assert.equal(features.count, 2);
  assert.equal(SfntTag.toString(features.items.get(1).tag), "kern");
  assert.equal(features.items.get(1).value, 0);
});

test("a very big text makes the memory of the module grow", () => {
  const unit = "ab";
  const text = new TMutableText();
  const big = unit.repeat(9_000_000);
  text.append(big);
  text.append("end");
  assert.equal(text.length, 18_000_003);
  assert.equal(text.getString(18_000_000, 18_000_003), "end");
  assert.equal(text.getString(0, 4), "abab");
  text.dispose();
});
