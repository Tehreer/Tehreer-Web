import assert from "node:assert/strict";
import { before, test } from "node:test";
import {
  BreakMode, ComposedLine, FrameResolver, LineLocator, Renderer, TMutableText, TextAlignment, TruncationPlace, Typesetter,
  VerticalAlignment, WritingDirection,
} from "../src/index.js";
import { NASTALIQ, ROBOTO, loadFont, ready } from "./Support.js";

before(ready);

const SIZE = 20;
const TEXT = "abc abc abc abc abc";

function typesetter(text = TEXT, font = ROBOTO, size = SIZE): Typesetter {
  return new Typesetter(text, { typeface: loadFont(font).typefaces.get(0), typeSize: size });
}

function frameOf(width: number, text = TEXT) {
  const resolver = new FrameResolver();
  resolver.typesetter = typesetter(text);
  resolver.frameWidth = width;
  resolver.frameHeight = 1000;
  return { resolver, frame: resolver.createFrame(0, text.length) };
}

test("a typesetter needs a typeface for every part of the text", () => {
  assert.throws(() => new Typesetter("abc"), /typesetter/);
});

test("a typesetter takes a text with attributes", () => {
  const text = new TMutableText("abcabc");
  const typeface = loadFont(ROBOTO).typefaces.get(0);
  text.setAttributes(0, 3, { typeface, typeSize: 10 });
  text.setAttributes(3, 6, { typeface, typeSize: 40 });
  const line = new Typesetter(text).createSimpleLine(0, 6);
  assert.deepEqual(line.runs.map((run) => run.typeSize), [10, 40]);
  assert.deepEqual(line.runs.map((run) => [run.startIndex, run.endIndex]), [[0, 3], [3, 6]]);
});

test("a simple line has runs, metrics and distances", () => {
  const line = typesetter().createSimpleLine(0, 3);
  assert.equal(line.startIndex, 0);
  assert.equal(line.endIndex, 3);
  assert.ok(line.width > 0 && line.ascent > 0 && line.descent > 0);
  assert.ok(line.height >= line.ascent + line.descent);
  assert.equal(line.paragraphLevel, 0);
  assert.ok(!line.isBlock && !line.isTruncated);
  assert.deepEqual(line.origin, { x: 0, y: 0 });

  assert.equal(line.runs.length, 1);
  const run = line.runs.get(0);
  assert.equal(run.glyphCount, 3);
  assert.equal(run.typeSize, SIZE);
  assert.equal(run.writingDirection, WritingDirection.LeftToRight);
  assert.equal(run.glyphIds.length, 3);
  assert.equal(run.glyphOffsets.length, 3);
  assert.equal(run.glyphAdvances.length, 3);
  assert.deepEqual([...run.clusterMap], [0, 1, 2]);
  assert.ok(run.typeface!.familyName === "Roboto");
  assert.ok(!run.isBackward && run.replacement === undefined);
  assert.ok(Math.abs(run.width - run.glyphAdvances.reduce((a, b) => a + b, 0)) < 0.01);
  assert.deepEqual(run.origin, { x: 0, y: 0 });

  assert.equal(line.getCodeUnitDistance(0), 0);
  assert.ok(Math.abs(line.getCodeUnitDistance(3) - line.width) < 0.01);
  assert.ok(line.getCodeUnitDistance(1) > 0 && line.getCodeUnitDistance(1) < line.getCodeUnitDistance(2));
  assert.throws(() => line.getCodeUnitDistance(4), RangeError);
  assert.equal(run.getCodeUnitDistance(1), line.getCodeUnitDistance(1));
  assert.equal(run.getClusterStart(1), 1);
  assert.equal(run.getClusterEnd(1), 2);
});

test("distances map back to code units", () => {
  const line = typesetter().createSimpleLine(0, 3);
  const middle = (line.getCodeUnitDistance(1) + line.getCodeUnitDistance(2)) / 2;
  assert.equal(line.getCodeUnitIndexAtDistance(line.getCodeUnitDistance(1) + 0.1), 1);
  assert.equal(line.getCodeUnitIndexAtDistance(-50), 0);
  assert.equal(line.getCodeUnitIndexAtDistance(line.width + 50), 3);
  assert.ok([1, 2].includes(line.runs.get(0).getCodeUnitIndexAtDistance(middle)));
});

test("the parts that a range covers are found, and the line is aligned", () => {
  const line = typesetter().createSimpleLine(0, 3);
  const edges = line.getVisualEdges(1, 2);
  assert.equal(edges.length, 1);
  assert.ok(Math.abs(edges[0]!.left - line.getCodeUnitDistance(1)) < 0.01);
  assert.ok(Math.abs(edges[0]!.right - line.getCodeUnitDistance(2)) < 0.01);
  assert.deepEqual(line.getVisualEdges(1, 1), []);
  assert.throws(() => line.getVisualEdges(1, 9), RangeError);

  assert.equal(line.getPenOffset(0, 500), 0);
  assert.ok(Math.abs(line.getPenOffset(0.5, line.width + 100) - 50) < 0.01);
  assert.ok(Math.abs(line.getPenOffset(1, line.width + 100) - 100) < 0.01);
});

test("ink boxes are measured by a renderer", () => {
  const line = typesetter().createSimpleLine(0, 3);
  const renderer = new Renderer();
  renderer.typeface = loadFont(ROBOTO).typefaces.get(0);
  renderer.typeSize = SIZE;
  const box = line.computeInkBox(renderer);
  assert.ok(box.width > 10 && box.height > 5);
  assert.ok(box.width <= line.width + 1);
  const runBox = line.runs.get(0).computeInkBox(renderer);
  assert.ok(Math.abs(runBox.width - box.width) < 0.5);
});

test("breaks are suggested for an extent", () => {
  const set = typesetter();
  const forward = set.suggestForwardBreak(0, TEXT.length, 60, BreakMode.Line);
  assert.ok(forward > 0 && forward < TEXT.length);
  const character = set.suggestForwardBreak(0, TEXT.length, 60, BreakMode.Character);
  assert.ok(character > 0 && character < TEXT.length);
  const backward = set.suggestBackwardBreak(0, TEXT.length, 60, BreakMode.Line);
  assert.ok(backward > 0 && backward < TEXT.length);
  assert.throws(() => set.suggestForwardBreak(0, 999, 10, BreakMode.Line), RangeError);
});

test("lines are truncated and justified", () => {
  const set = typesetter();
  const token = set.createTruncationToken(0, TEXT.length, TruncationPlace.End, "…");
  assert.ok(token.width > 0);
  const whole = set.createSimpleLine(0, TEXT.length);
  const truncated = set.createTruncatedLine(0, TEXT.length, whole.width / 2, BreakMode.Line, TruncationPlace.End, token);
  assert.ok(truncated.isTruncated);
  assert.equal(truncated.startIndex, 0);
  assert.equal(truncated.endIndex, TEXT.length);
  assert.ok(truncated.width <= whole.width / 2 + 0.5);
  assert.ok(!set.createTruncatedLine(0, TEXT.length, whole.width * 2, BreakMode.Line, TruncationPlace.End, token).isTruncated);
  assert.throws(() => set.createTruncatedLine(3, 3, 10, BreakMode.Line, TruncationPlace.End, token), RangeError);

  const short = set.createSimpleLine(0, 7);
  const justified = set.createJustifiedLine(0, 7, 1, short.width + 40);
  assert.ok(Math.abs(justified.width - (short.width + 40)) < 0.5, `${justified.width} vs ${short.width + 40}`);
  assert.throws(() => set.createJustifiedLine(2, 2, 1, 10), RangeError);
});

test("a resolver keeps its settings, including the structs that Core takes by value", () => {
  const resolver = new FrameResolver();
  resolver.frameWidth = 123.5;
  resolver.frameHeight = 456.25;
  assert.deepEqual([resolver.frameWidth, resolver.frameHeight], [123.5, 456.25]);
  resolver.frameWidth = 10;
  assert.deepEqual([resolver.frameWidth, resolver.frameHeight], [10, 456.25], "the height is kept");
  resolver.frameHeight = 20;
  assert.deepEqual([resolver.frameWidth, resolver.frameHeight], [10, 20], "and the width");

  resolver.fitsHorizontally = true;
  resolver.fitsVertically = true;
  resolver.textAlignment = TextAlignment.Trailing;
  resolver.verticalAlignment = VerticalAlignment.Bottom;
  resolver.truncationMode = BreakMode.Character;
  resolver.truncationPlace = TruncationPlace.Middle;
  resolver.isTruncationEnabled = true;
  resolver.isJustificationEnabled = true;
  resolver.justificationLevel = 0.5;
  resolver.maxLines = 3;
  resolver.extraLineSpacing = 2;
  resolver.lineHeightMultiplier = 1.5;
  assert.ok(resolver.fitsHorizontally && resolver.fitsVertically);
  assert.equal(resolver.textAlignment, TextAlignment.Trailing);
  assert.equal(resolver.verticalAlignment, VerticalAlignment.Bottom);
  assert.equal(resolver.truncationMode, BreakMode.Character);
  assert.equal(resolver.truncationPlace, TruncationPlace.Middle);
  assert.ok(resolver.isTruncationEnabled && resolver.isJustificationEnabled);
  assert.deepEqual([resolver.justificationLevel, resolver.maxLines, resolver.extraLineSpacing, resolver.lineHeightMultiplier], [0.5, 3, 2, 1.5]);
  resolver.maxLines = undefined;
  assert.equal(resolver.maxLines, undefined);
});

test("a resolver needs a typesetter and a range within the text", () => {
  const resolver = new FrameResolver();
  assert.throws(() => resolver.createFrame(0, 1), /typesetter/);
  resolver.typesetter = typesetter();
  assert.throws(() => resolver.createFrame(0, 999), RangeError);
});

test("a frame breaks the text into lines", () => {
  const { frame } = frameOf(70);
  assert.ok(frame.lines.length >= 2);
  assert.equal(frame.startIndex, 0);
  assert.equal(frame.endIndex, TEXT.length);
  assert.ok(frame.width <= 70 && frame.height > 0);

  let end = 0;
  let top = -1;
  for (const line of frame.lines) {
    assert.equal(line.startIndex, end);
    end = line.endIndex;
    assert.ok(line.origin.y > top);
    top = line.origin.y;
  }
  assert.equal(end, TEXT.length);
  assert.ok(frame.lines.get(0).equals(frame.lines.get(0)));
  assert.throws(() => frame.lines.get(frame.lines.length), RangeError);
});

test("positions and code units are mapped to lines", () => {
  const { frame } = frameOf(70);
  const second = frame.lines.get(1);
  assert.equal(frame.getLineIndexForCodeUnit(0), 0);
  assert.equal(frame.getLineIndexForCodeUnit(second.startIndex), 1);
  assert.equal(frame.getLineIndexForCodeUnit(TEXT.length), frame.lines.length - 1);
  assert.equal(frame.getLineIndexForCodeUnit(TEXT.length + 5), -1);
  assert.equal(frame.getLineIndexAtPosition(0, frame.lines.get(0).origin.y), 0);
  assert.equal(frame.getLineIndexAtPosition(5, second.origin.y), 1);
  assert.equal(frame.getLineIndexAtPosition(5, 100000), frame.lines.length - 1);
});

test("selections are rectangles", () => {
  const { frame } = frameOf(70);
  const rects = frame.getSelectionRects(2, 12);
  assert.ok(rects.length >= 2);
  assert.ok(rects.every((rect) => rect.width > 0 && rect.height > 0 && rect.x >= 0 && rect.x + rect.width <= frame.width + 0.01));
  assert.deepEqual(frame.getSelectionRects(3, 3), []);
  assert.throws(() => frame.getSelectionRects(0, 99), RangeError);
});

test("a frame is limited by lines, and fits its content", () => {
  const { resolver } = frameOf(70);
  resolver.maxLines = 1;
  assert.equal(resolver.createFrame(0, TEXT.length).lines.length, 1);
  resolver.maxLines = undefined;

  resolver.fitsHorizontally = true;
  resolver.frameWidth = 500;
  const fitted = resolver.createFrame(0, 7);
  assert.ok(fitted.width < 500);

  resolver.fitsHorizontally = false;
  resolver.fitsVertically = true;
  resolver.frameHeight = 5;
  assert.ok(resolver.createFrame(0, TEXT.length).height > 5);
});

test("the last line is truncated when there is no room", () => {
  const { resolver } = frameOf(70);
  resolver.maxLines = 2;
  resolver.isTruncationEnabled = true;
  const frame = resolver.createFrame(0, TEXT.length);
  assert.equal(frame.lines.length, 2);
  assert.ok(frame.lines.get(1).isTruncated);
});

test("lines are aligned and justified by the frame", () => {
  const { resolver } = frameOf(120);
  resolver.textAlignment = TextAlignment.Right;
  const right = resolver.createFrame(0, TEXT.length);
  assert.ok(right.lines.get(0).origin.x > 0);
  resolver.textAlignment = TextAlignment.Left;
  assert.equal(resolver.createFrame(0, TEXT.length).lines.get(0).origin.x, 0);
  resolver.isJustificationEnabled = true;
  const justified = resolver.createFrame(0, TEXT.length);
  const first = justified.lines.get(0);
  assert.ok(Math.abs(first.width - first.trailingWhitespaceExtent - 120) < 1, "the text fills the frame");
});

test("a line locator finds the lines of an area", () => {
  const { frame } = frameOf(70);
  const renderer = new Renderer();
  renderer.typeface = loadFont(ROBOTO).typefaces.get(0);
  renderer.typeSize = SIZE;
  const locator = new LineLocator(frame, renderer);
  assert.equal(locator.lineCount, frame.lines.length);
  
  const boxes = Array.from({ length: locator.lineCount }, (_, index) => locator.getLineBox(index));
  assert.ok(boxes.every((box, index) => index === 0 || box.y > boxes[index - 1]!.y));
  const all = locator.findLines({ x: -10, y: -10, width: 1000, height: 1000 });
  assert.deepEqual(all, [...Array(frame.lines.length).keys()]);
  assert.deepEqual(locator.findLines({ x: 0, y: boxes[1]!.y + 1, width: 1, height: 1 }), [1]);
  assert.equal(locator.getFirstLineIndexBelow(-100), 0);
  assert.throws(() => locator.getLineBox(99), RangeError);
});

test("right to left text has a right to left paragraph", () => {
  const text = "تحریر ایک متنی انجن ہے";
  const set = typesetter(text, NASTALIQ, 30);
  const line: ComposedLine = set.createSimpleLine(0, text.length);
  assert.equal(line.paragraphLevel % 2, 1);
  assert.ok(line.runs.some((run) => run.writingDirection === WritingDirection.RightToLeft));
  assert.ok(line.runs.every((run) => run.bidiLevel % 2 === 1));
  assert.ok(Math.abs(line.getCodeUnitDistance(line.endIndex) - line.width) < 0.5);
  assert.ok(line.getCodeUnitDistance(0) > 0, "the start of a right to left line is at its right");
});

test("objects of a frame outlive it when they are disposed first", () => {
  const { frame } = frameOf(70);
  const line = frame.lines.get(0);
  const run = line.runs.get(0);
  frame.dispose();
  assert.ok(line.width > 0);
  line.dispose();
  assert.ok(run.glyphCount > 0);
});
