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
import { test } from "node:test";
import { computeVisibleRange } from "../src/react/scroll.js";
import { assignSlots, NO_SLOTS } from "../src/react/slots.js";

test("nothing of a content below the viewport is visible, and the part that fits is when it is in", () => {
  assert.deepEqual(computeVisibleRange(300, 800), { top: 0, bottom: 500 });
  assert.deepEqual(computeVisibleRange(0, 800), { top: 0, bottom: 800 });
});

test("a content that scrolled up shows its part from the top of the viewport", () => {
  assert.deepEqual(computeVisibleRange(-1000, 800), { top: 1000, bottom: 1800 });
});

test("the range stays inside of the content", () => {
  assert.deepEqual(computeVisibleRange(-1000, 800, 1500), { top: 1000, bottom: 1500 });
  assert.deepEqual(computeVisibleRange(-2000, 800, 1500), { top: 1500, bottom: 1500 });
  assert.deepEqual(computeVisibleRange(900, 800, 1500), { top: 0, bottom: 0 });
});

test("the first lines take the first slots, in order", () => {
  const assignment = assignSlots(NO_SLOTS, [10, 11, 12]);
  assert.deepEqual([...assignment.slots], [[10, 0], [11, 1], [12, 2]]);
  assert.equal(assignment.slotCount, 3);
});

test("lines that stay keep their slot, and a new line takes a freed one", () => {
  const first = assignSlots(NO_SLOTS, [10, 11, 12]);
  const second = assignSlots(first, [11, 12, 13]);
  assert.equal(second.slots.get(11), 1);
  assert.equal(second.slots.get(12), 2);
  assert.equal(second.slots.get(13), 0);
  assert.equal(second.slotCount, 3);
});

test("a slot is added only when all are busy, and none is dropped", () => {
  const first = assignSlots(NO_SLOTS, [1, 2, 3]);
  const grown = assignSlots(first, [1, 2, 3, 4]);
  assert.equal(grown.slotCount, 4);
  const shrunk = assignSlots(grown, [4]);
  assert.equal(shrunk.slotCount, 4);
  assert.deepEqual([...shrunk.slots], [[4, 3]]);
});

test("nothing is kept for lines that are gone, and the same lines give the same assignment", () => {
  const first = assignSlots(NO_SLOTS, [5, 6]);
  assert.equal(assignSlots(first, [6, 5]), first);
  const far = assignSlots(first, [90, 91]);
  assert.deepEqual([...far.slots].map(([line]) => line), [90, 91]);
  assert.deepEqual([...far.slots].map(([, slot]) => slot).sort(), [0, 1]);
});
