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
import { List, Renderer, ShapingEngine } from "../src/index.js";
import { ROBOTO, ROBOTO_VARIABLE, loadFont, ready } from "./Support.js";

before(ready);

function shape(text = "abcabc") {
  const shaper = new ShapingEngine();
  shaper.typeface = loadFont(ROBOTO).typefaces.get(0);
  shaper.typeSize = 40;
  return shaper.shapeText(text);
}

test("a list is read from the memory of Core when an element is asked for", () => {
  const result = shape();
  const ids = result.glyphIds;
  assert.ok(ids instanceof List);
  assert.equal(ids.length, 6);
  assert.equal(ids.get(0), ids.get(3));
  assert.equal(ids.at(-1), ids.get(5));
  assert.equal(ids.at(6), undefined);
  assert.equal(ids.at(-7), undefined);
  assert.throws(() => ids.get(6), RangeError);
  assert.throws(() => ids.get(-1), RangeError);
  assert.throws(() => ids.get(1.5), RangeError);
  assert.ok(!ids.isEmpty);
});

test("lists can be iterated and searched like arrays", () => {
  const ids = shape().glyphIds;
  assert.deepEqual([...ids], ids.toArray());
  assert.equal(ids.map((id) => id * 2).length, 6);
  assert.equal(ids.findIndex((id) => id === ids.get(1)), 1);
  assert.equal(ids.find((id) => id > 0), ids.get(0));
  assert.ok(ids.some((id) => id === ids.get(2)) && ids.every((id) => id > 0));
  assert.equal(ids.reduce((count) => count + 1, 0), 6);
  const seen: number[] = [];
  ids.forEach((_id, index) => seen.push(index));
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5]);
});

test("a slice is a view of a part of a list", () => {
  const advances = shape().glyphAdvances;
  const part = advances.slice(2, 5);
  assert.equal(part.length, 3);
  assert.equal(part.get(0), advances.get(2));
  assert.equal(part.slice(1).get(0), advances.get(3));
  assert.deepEqual(part.toTypedArray(), advances.toTypedArray().subarray(2, 5));
  assert.throws(() => advances.slice(4, 2), RangeError);
  assert.throws(() => advances.slice(0, 9), RangeError);
  assert.equal(advances.slice().length, 6);
});

test("numbers and points are copied to typed arrays", () => {
  const result = shape();
  assert.ok(result.glyphIds.toTypedArray() instanceof Uint16Array);
  assert.ok(result.glyphAdvances.toTypedArray() instanceof Float32Array);
  assert.ok(result.clusterMap.toTypedArray() instanceof Uint32Array);
  assert.deepEqual([...result.clusterMap], [0, 1, 2, 3, 4, 5]);

  const offsets = result.glyphOffsets;
  assert.deepEqual(offsets.get(0), { x: 0, y: 0 });
  assert.equal(offsets.toFloat32Array().length, 12);
});

test("a list of an object cannot be read once the object is disposed", () => {
  const result = shape();
  const ids = result.glyphIds;
  const sliced = ids.slice(1, 3);
  assert.ok(ids.get(0) > 0);
  result.dispose();
  assert.throws(() => ids.get(0), /already disposed/);
  assert.throws(() => sliced.get(0), /already disposed/);
  assert.throws(() => ids.toTypedArray(), /already disposed/);
});

test("the elements of a list of structs are read when their properties are", () => {
  const typeface = loadFont(ROBOTO_VARIABLE).typefaces.get(0);
  const style = typeface.namedStyles.get(0);
  assert.equal(style.coordinates.length, 2);
  assert.ok(style.coordinates.toTypedArray() instanceof Float32Array);
  assert.ok(typeface.variationAxes.get(1).defaultValue > 0);

  const axis = typeface.variationAxes.get(0);
  typeface.dispose();
  assert.throws(() => axis.name, /already disposed/);
});

test("a list of objects makes them when they are asked for", () => {
  const file = loadFont(ROBOTO_VARIABLE);
  const typefaces = file.typefaces;
  assert.equal(typefaces.length, 18);
  assert.ok(typefaces.get(3).namedStyles.length > 0);
  assert.ok(!typefaces.get(0).equals(typefaces.get(1)));
  assert.ok(typefaces.get(4).equals(typefaces.slice(2).get(2)));
  assert.throws(() => typefaces.get(18), RangeError);
});

test("a list of Core is passed to a renderer without being copied", () => {
  const renderer = new Renderer();
  renderer.typeface = loadFont(ROBOTO).typefaces.get(0);
  renderer.typeSize = 40;
  const result = shape();

  const direct = renderer.computeRunInkBox(result);
  const copied = renderer.computeRunInkBox({
    glyphIds: result.glyphIds.toArray(),
    glyphOffsets: result.glyphOffsets.toArray(),
    glyphAdvances: result.glyphAdvances.toArray(),
  });
  assert.deepEqual(direct, copied);

  const part = renderer.computeRunInkBox({
    glyphIds: result.glyphIds.slice(0, 2),
    glyphOffsets: result.glyphOffsets.slice(0, 2),
    glyphAdvances: result.glyphAdvances.slice(0, 2),
  });
  assert.ok(part.width < direct.width);
});
