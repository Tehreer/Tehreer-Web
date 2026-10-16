import assert from "node:assert/strict";
import { before, test } from "node:test";
import { malloc, free, withStack } from "../src/internal/Memory.js";
import { Module } from "../src/internal/Module.js";
import { f32, struct, u32, u8, union } from "../src/internal/Struct.js";
import { TRAttribute, TRPoint, TRRect, structs } from "../src/internal/Structs.js";
import { ready } from "./Support.js";

before(ready);

interface Layout {
  readonly [name: string]: { readonly size: number; readonly [field: string]: number };
}

/** The layouts that the compiler made, which the module writes as JSON. */
function compilerLayouts(): Layout {
  const capacity = 1 << 14;
  const buffer = malloc(capacity);
  try {
    const length = Module._tw_layout(buffer, capacity);
    assert.ok(length > 0 && length < capacity, "the buffer was big enough");
    return JSON.parse(new TextDecoder().decode(Module.HEAPU8.subarray(buffer, buffer + length))) as Layout;
  } finally {
    free(buffer);
  }
}

test("every struct of Core that is described by hand has the layout that the compiler made", () => {
  const compiled = compilerLayouts();
  for (const [name, type] of Object.entries(structs)) {
    const expected = compiled[name];
    assert.ok(expected !== undefined, `${name} is checked by the compiler`);
    assert.equal(type.size, expected.size, `${name}: size`);
    for (const [field, offset] of Object.entries(type.offsets)) {
      assert.equal(offset, expected[field], `${name}.${field}: offset`);
    }
    const missing = Object.keys(expected).filter((key) => key !== "size" && !(key in type.offsets));
    assert.deepEqual(missing, [], `${name} describes all of its fields`);
  }
  const unchecked = Object.keys(compiled).filter((name) => !(name in structs));
  assert.deepEqual(unchecked, [], "every struct that the compiler knows is described");
});

test("offsets and sizes follow the alignment of a 32-bit target", () => {
  const sample = struct({ flag: u8, count: u32, ratio: f32, tail: u8 });
  assert.deepEqual(sample.offsets, { flag: 0, count: 4, ratio: 8, tail: 12 });
  assert.equal(sample.size, 16);
  const merged = union({ byte: u8, word: u32 });
  assert.deepEqual(merged.offsets, { byte: 0, word: 0 });
  assert.equal(merged.size, 4);
});

test("a view reads and writes the memory when its properties are used", () => {
  withStack((stack) => {
    const address = TRRect.allocate(stack, { x: 1, y: 2, width: 3, height: 4 });
    const view = TRRect.view(address);
    assert.deepEqual(TRRect.snapshot(address), { x: 1, y: 2, width: 3, height: 4 });
    view.width = 30;
    assert.equal(TRRect.snapshot(address).width, 30);
    TRRect.assign(address, { y: 20 });
    assert.equal(view.y, 20);
    assert.equal(view.x, 1, "a field that is not given is left as it is");
  });
});

test("a view of an element of an array is placed by the size of the struct", () => {
  withStack((stack) => {
    const base = stack.alloc(TRPoint.size * 3);
    TRPoint.assign(TRPoint.at(base, 2).x === 0 ? base + TRPoint.size * 2 : base, { x: 5, y: 6 });
    assert.deepEqual(TRPoint.snapshot(base + 16), { x: 5, y: 6 });
    assert.deepEqual({ x: TRPoint.at(base, 2).x, y: TRPoint.at(base, 2).y }, { x: 5, y: 6 });
  });
});

test("a view stays right when the memory of the module grows", () => {
  withStack((stack) => {
    const address = TRPoint.allocate(stack, { x: 7, y: 8 });
    const view = TRPoint.view(address);
    const before = Module.HEAPU8;
    const big = malloc(64 * 1024 * 1024);
    try {
      assert.notEqual(Module.HEAPU8, before, "the memory grew, and the old view of it is detached");
      assert.equal(view.x, 7);
      assert.equal(view.y, 8);
    } finally {
      free(big);
    }
  });
});

test("a union has its members at one address", () => {
  withStack((stack) => {
    const address = TRAttribute.allocate(stack, { type: 7 });
    const value = TRAttribute.view(address).value;
    value.float = 1.5;
    assert.equal(value.float, 1.5);
    value.uint = 0x3fc00000;
    assert.equal(value.float, 1.5, "the bits of 1.5 as an integer");
    value.boolean = true;
    assert.equal(value.byte, 1);
    assert.equal(TRAttribute.view(address).type, 7);
  });
});

test("a struct that Core takes by value is passed, and one that it returns is read", () => {
  const box = TRRect.passing({ x: 1, y: 2, width: 3, height: 4 }, (address) => TRRect.snapshot(address));
  assert.deepEqual(box, { x: 1, y: 2, width: 3, height: 4 });
  const made = TRPoint.returning((address) => TRPoint.assign(address, { x: 9, y: 10 }));
  assert.deepEqual(made, { x: 9, y: 10 });
});
