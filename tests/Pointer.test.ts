import assert from "node:assert/strict";
import { test } from "node:test";
import { PointerGestures, TAP_SLOP, type CodeUnitEvents } from "../src/react/pointer.js";

/** A line of text where every 10 pixels is a code unit, from x = 0 up to 100. */
function setup(events: CodeUnitEvents = {}) {
  const log: string[] = [];
  let scroll = 0;
  const gestures = new PointerGestures(() => ({
    source: {
      hitTest: (x) => (x >= 0 && x < 100 ? Math.floor(x / 10) : undefined),
      getScroll: () => scroll,
    },
    events: {
      onHoverChange: (index) => log.push(`hover ${index}`),
      onPressChange: (index) => log.push(`press ${index}`),
      onTap: (index) => log.push(`tap ${index}`),
      ...events,
    },
  }));
  return { gestures, log, scrollTo: (value: number) => (scroll = value) };
}

test("a hover is reported when the code unit under the mouse changes, not for every move", () => {
  const { gestures, log } = setup();
  gestures.move(5, 0);
  gestures.move(7, 0);
  gestures.move(15, 0);
  gestures.leave();
  gestures.leave();
  assert.deepEqual(log, ["hover 0", "hover 1", "hover undefined"]);
});

test("a hover is not reported for a touch", () => {
  const { gestures, log } = setup();
  gestures.move(5, 0, false);
  assert.deepEqual(log, []);
});

test("a press and a release in the same place are a tap", () => {
  const { gestures, log } = setup();
  gestures.down(25, 0);
  gestures.up(26, 1);
  assert.deepEqual(log, ["press 2", "press undefined", "tap 2"]);
});

test("a tap on empty space is told with no index and has no press", () => {
  const { gestures, log } = setup();
  gestures.down(150, 0);
  gestures.up(150, 0);
  assert.deepEqual(log, ["tap undefined"]);
});

test("moving further than the slop ends the press and the release is not a tap", () => {
  const { gestures, log } = setup();
  gestures.down(25, 0);
  gestures.move(25 + TAP_SLOP + 1, 0, false);
  gestures.up(25 + TAP_SLOP + 1, 0);
  assert.deepEqual(log, ["press 2", "press undefined"]);
});

test("a scroll during the press makes the release not a tap", () => {
  const { gestures, log, scrollTo } = setup();
  gestures.down(25, 0);
  scrollTo(40);
  gestures.up(25, 0);
  assert.deepEqual(log, ["press 2", "press undefined"]);
});

test("a cancel ends the press and the hover", () => {
  const { gestures, log } = setup();
  gestures.move(25, 0);
  gestures.down(25, 0);
  gestures.cancel();
  gestures.up(25, 0);
  assert.deepEqual(log, ["hover 2", "press 2", "press undefined", "hover undefined"]);
});

test("only the main button presses", () => {
  const { gestures, log } = setup();
  gestures.down(25, 0, 2);
  gestures.up(25, 0);
  assert.deepEqual(log, []);
});

test("a widget can end the press when its content scrolls", () => {
  const { gestures, log } = setup();
  gestures.down(25, 0);
  gestures.cancelPress();
  assert.deepEqual(log, ["press 2", "press undefined"]);
});
