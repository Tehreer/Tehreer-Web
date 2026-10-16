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
import {
  BaseDirection,
  BidiAlgorithm,
  BidiClass,
  BidiPair,
  BidiRun,
  CodePoint,
  GeneralCategory,
  Script,
  ScriptClassifier,
  ScriptRun,
  SfntTag,
} from "../src/index.js";
import { ready } from "./Support.js";

before(ready);

const ARABIC = "ابج";

test("code points tell their properties", () => {
  assert.equal(CodePoint.getBidiClass(0x61), BidiClass.LeftToRight);
  assert.equal(CodePoint.getBidiClass(0x627), BidiClass.RightToLeftArabic);
  assert.equal(CodePoint.getBidiClass(0x5d0), BidiClass.RightToLeft);
  assert.equal(CodePoint.getGeneralCategory(0x41), GeneralCategory.UppercaseLetter);
  assert.equal(CodePoint.getGeneralCategory(0x20), GeneralCategory.SpaceSeparator);
  assert.equal(CodePoint.getScript(0x627), Script.Arabic);
  assert.equal(CodePoint.getScript(0x61), Script.Latin);
  assert.equal(CodePoint.getMirror(0x28), 0x29);
  assert.equal(CodePoint.getMirror(0x61), 0);
});

test("scripts know their tags", () => {
  assert.equal(Script.getOpenTypeTag(Script.Arabic), SfntTag.make("arab"));
  assert.equal(Script.getOpenTypeTag(Script.Devanagari), SfntTag.make("dev2"));
  assert.equal(Script.getUnicodeTag(Script.Arabic), SfntTag.make("Arab"));
});

test("an algorithm needs a text, and its ranges are checked", () => {
  assert.throws(() => new BidiAlgorithm(""), RangeError);
  using algorithm = new BidiAlgorithm("abc");
  assert.throws(() => algorithm.getParagraphBoundary(-1, 2), RangeError);
  assert.throws(() => algorithm.getParagraphBoundary(0, 4), RangeError);
  assert.throws(() => algorithm.getParagraphBoundary(2, 2), RangeError);
  assert.throws(() => algorithm.createParagraph(0, 3, 126), RangeError);
  assert.throws(() => algorithm.createParagraph(0, 3, 0x80), RangeError);
  assert.throws(() => algorithm.createParagraph(0, 3, 1.5), RangeError);
});

test("an algorithm lists the bidi class of each character", () => {
  using algorithm = new BidiAlgorithm(`a ${ARABIC}1`);
  assert.deepEqual(algorithm.charBidiClasses.toArray(), [
    BidiClass.LeftToRight,
    BidiClass.WhiteSpace,
    BidiClass.RightToLeftArabic,
    BidiClass.RightToLeftArabic,
    BidiClass.RightToLeftArabic,
    BidiClass.EuropeanNumber,
  ]);
  assert.deepEqual([...algorithm.charBidiClasses.toTypedArray()].length, 6);
});

test("paragraph boundaries follow the separators", () => {
  using algorithm = new BidiAlgorithm("ab\ncd\r\nef");
  assert.equal(algorithm.getParagraphBoundary(0, 9), 3);
  assert.equal(algorithm.getParagraphBoundary(3, 9), 7);
  assert.equal(algorithm.getParagraphBoundary(7, 9), 9);
  assert.equal(algorithm.getParagraphBoundary(0, 2), 2);
});

test("a paragraph resolves its levels and its runs", () => {
  using algorithm = new BidiAlgorithm(`abc ${ARABIC} def`);
  using paragraph = algorithm.createParagraph(0, 11, BaseDirection.DefaultLeftToRight);
  assert.equal(paragraph.startIndex, 0);
  assert.equal(paragraph.endIndex, 11);
  assert.equal(paragraph.baseLevel, 0);
  assert.deepEqual(paragraph.charLevels.toArray(), [0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0]);
  assert.deepEqual([...paragraph.logicalRuns], [new BidiRun(0, 4, 0), new BidiRun(4, 7, 1), new BidiRun(7, 11, 0)]);
  assert.ok([...paragraph.logicalRuns][1]?.isRightToLeft);
});

test("a base direction can be found from the text or given", () => {
  using algorithm = new BidiAlgorithm(`${ARABIC} abc`);
  using detected = algorithm.createParagraph(0, 7, BaseDirection.DefaultLeftToRight);
  assert.equal(detected.baseLevel, 1);
  using forced = algorithm.createParagraph(0, 7, BaseDirection.LeftToRight);
  assert.equal(forced.baseLevel, 0);
  using level = algorithm.createParagraph(0, 7, 2);
  assert.equal(level.baseLevel, 2);
});

test("a paragraph ends where the first separator is", () => {
  using algorithm = new BidiAlgorithm("ab\ncd");
  using second = algorithm.createParagraph(3, 5, BaseDirection.LeftToRight);
  assert.equal(second.startIndex, 3);
  assert.equal(second.endIndex, 5);
  using first = algorithm.createParagraph(0, 5, BaseDirection.LeftToRight);
  assert.equal(first.endIndex, 3);
});

test("a line orders its runs visually", () => {
  using algorithm = new BidiAlgorithm(`${ARABIC} abc`);
  using paragraph = algorithm.createParagraph(0, 7, BaseDirection.RightToLeft);
  using line = paragraph.createLine(0, 7);
  assert.equal(line.startIndex, 0);
  assert.equal(line.endIndex, 7);
  const runs = line.visualRuns;
  assert.equal(runs.length, 2);
  assert.deepEqual(runs.toArray(), [new BidiRun(4, 7, 2), new BidiRun(0, 4, 1)]);
  assert.throws(() => runs.get(2), RangeError);

  using part = paragraph.createLine(4, 7);
  assert.deepEqual(part.visualRuns.toArray(), [new BidiRun(4, 7, 2)]);
});

test("a line lists the characters that are mirrored", () => {
  using algorithm = new BidiAlgorithm(`${ARABIC} (${ARABIC})`);
  using paragraph = algorithm.createParagraph(0, 9, BaseDirection.RightToLeft);
  using line = paragraph.createLine(0, 9);
  const pairs = [...line.mirroringPairs];
  assert.deepEqual(pairs, [new BidiPair(4, 0x28, 0x29), new BidiPair(8, 0x29, 0x28)]);
  assert.ok(pairs[0]?.equals(new BidiPair(4, 0x28, 0x29)));

  using ltr = algorithm.createParagraph(0, 9, BaseDirection.LeftToRight);
  using ltrLine = ltr.createLine(0, 9);
  assert.equal([...ltrLine.mirroringPairs].length, 2);
  using latin = new BidiAlgorithm("a (b)");
  using latinParagraph = latin.createParagraph(0, 5, BaseDirection.LeftToRight);
  using latinLine = latinParagraph.createLine(0, 5);
  assert.deepEqual([...latinLine.mirroringPairs], []);
});

test("a paragraph rejects a line outside of it", () => {
  using algorithm = new BidiAlgorithm("ab\ncd");
  using paragraph = algorithm.createParagraph(3, 5, BaseDirection.LeftToRight);
  assert.throws(() => paragraph.createLine(2, 5), RangeError);
  assert.throws(() => paragraph.createLine(3, 6), RangeError);
  assert.throws(() => paragraph.createLine(4, 4), RangeError);
});

test("paragraphs and lines outlive the algorithm, and fail once they are disposed", () => {
  const algorithm = new BidiAlgorithm(`${ARABIC} (${ARABIC})`);
  const paragraph = algorithm.createParagraph(0, 9, BaseDirection.RightToLeft);
  const line = paragraph.createLine(0, 9);
  algorithm.dispose();
  paragraph.dispose();

  assert.ok(algorithm.isDisposed);
  assert.equal(line.visualRuns.length, 1);
  assert.equal([...line.mirroringPairs].length, 2);
  line.dispose();
  assert.throws(() => line.startIndex, /already disposed/);
  assert.throws(() => paragraph.charLevels, /already disposed/);
  assert.throws(() => algorithm.charBidiClasses, /already disposed/);
});

test("lists of a disposed owner fail when they are read", () => {
  const algorithm = new BidiAlgorithm("abc");
  const classes = algorithm.charBidiClasses;
  assert.equal(classes.length, 3);
  algorithm.dispose();
  assert.throws(() => classes.get(0), /already disposed/);
});

test("a script classifier resolves the script of each character", () => {
  using classifier = new ScriptClassifier(`abc ${ARABIC} 12`);
  assert.equal(classifier.text, `abc ${ARABIC} 12`);
  assert.equal(classifier.charScripts.length, 10);
  assert.deepEqual([...classifier.scriptRuns], [
    new ScriptRun(0, 4, Script.Latin),
    new ScriptRun(4, 10, Script.Arabic),
  ]);
  assert.deepEqual([...classifier.getScriptRuns(2, 6)], [
    new ScriptRun(2, 4, Script.Latin),
    new ScriptRun(4, 6, Script.Arabic),
  ]);
  assert.deepEqual([...classifier.getScriptRuns(5, 5)], []);
  assert.throws(() => classifier.getScriptRuns(3, 11), RangeError);
  assert.throws(() => classifier.getScriptRuns(6, 3), RangeError);
});

test("a script classifier works with surrogate pairs and an empty text", () => {
  using classifier = new ScriptClassifier("a\u{1F600}b");
  assert.equal(classifier.charScripts.length, 4);
  assert.equal(classifier.charScripts.get(0), Script.Latin);
  assert.equal(classifier.charScripts.get(3), Script.Latin);

  using empty = new ScriptClassifier("");
  assert.equal(empty.charScripts.length, 0);
  assert.deepEqual([...empty.scriptRuns], []);
});

test("long texts are classified and analysed", () => {
  const text = `abc ${ARABIC} `.repeat(20000);
  using algorithm = new BidiAlgorithm(text);
  using paragraph = algorithm.createParagraph(0, text.length, BaseDirection.DefaultLeftToRight);
  assert.equal(paragraph.endIndex, text.length);
  assert.equal(paragraph.charLevels.length, text.length);
  using classifier = new ScriptClassifier(text);
  assert.equal([...classifier.scriptRuns].length, 40000);
});
