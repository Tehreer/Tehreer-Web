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

import type { Float, Int32, NumberKind, TypedArrays, UInt16, UInt32, UInt8 } from "../collections/NumberKind.js";
import { Stack, free, malloc, withStack } from "./Memory.js";
import { Module } from "./Module.js";

/**
 * Something that has a place in memory, and can be read from it and written to it. All of them
 * read the memory of the module when they are asked, so nothing that is read can go stale when the
 * memory grows.
 */
export interface Field<T> {
  /** The number of bytes that it takes. */
  readonly size: number;
  /** The address of a value has to be a multiple of this. */
  readonly alignment: number;
  read(address: number): T;
  write(address: number, value: T): void;
}

/** A field of numbers that can be copied out of memory in bulk. */
export interface NumberField<K extends NumberKind = NumberKind> extends Field<number> {
  /** Copies `count` consecutive values, which starts at `address`, to a new typed array. */
  copy(address: number, count: number): TypedArrays[K];
}

function numberField<K extends NumberKind>(
  size: number,
  read: (address: number) => number,
  write: (address: number, value: number) => void,
  copy: (address: number, count: number) => TypedArrays[K],
): NumberField<K> {
  return { size, alignment: size, read, write, copy };
}

export const u8: NumberField<UInt8> = numberField(
  1,
  (address) => Module.HEAPU8[address] ?? 0,
  (address, value) => {
    Module.HEAPU8[address] = value;
  },
  (address, count) => Module.HEAPU8.slice(address, address + count),
);

export const u16: NumberField<UInt16> = numberField(
  2,
  (address) => Module.HEAPU16[address >> 1] ?? 0,
  (address, value) => {
    Module.HEAPU16[address >> 1] = value;
  },
  (address, count) => Module.HEAPU16.slice(address >> 1, (address >> 1) + count),
);

export const i32: NumberField<Int32> = numberField(
  4,
  (address) => Module.HEAP32[address >> 2] ?? 0,
  (address, value) => {
    Module.HEAP32[address >> 2] = value;
  },
  (address, count) => Module.HEAP32.slice(address >> 2, (address >> 2) + count),
);

export const u32: NumberField<UInt32> = numberField(
  4,
  (address) => Module.HEAPU32[address >> 2] ?? 0,
  (address, value) => {
    Module.HEAPU32[address >> 2] = value;
  },
  (address, count) => Module.HEAPU32.slice(address >> 2, (address >> 2) + count),
);

export const f32: NumberField<Float> = numberField(
  4,
  (address) => Module.HEAPF32[address >> 2] ?? 0,
  (address, value) => {
    Module.HEAPF32[address >> 2] = value;
  },
  (address, count) => Module.HEAPF32.slice(address >> 2, (address >> 2) + count),
);

/** A pointer, which is 32 bits wide in WebAssembly. The same holds for `TRUInteger`. */
export const ptr: NumberField<UInt32> = u32;

/** `TRBoolean`, which is a byte. */
export const bool: Field<boolean> = {
  size: 1,
  alignment: 1,
  read: (address) => u8.read(address) !== 0,
  write: (address, value) => u8.write(address, value ? 1 : 0),
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Fields = Record<string, Field<any>>;

/** The values of the fields of a struct, by their names. */
export type Values<F extends Fields> = {
  -readonly [K in keyof F]: F[K] extends Field<infer T> ? T : never;
};

/** The description of a struct of C, as a layout that has been worked out from its fields. */
export interface StructType<F extends Fields> extends Field<Values<F>> {
  /** The offset of each field, which the compiler checks against the one of the C struct. */
  readonly offsets: { readonly [K in keyof F]: number };

  /**
   * Makes a view of the struct at an address. Each property reads the memory when it is asked,
   * and writes to it when it is set, so the view is as fresh as the memory is.
   */
  view(address: number): Values<F>;

  /** Makes a view of an element of an array of the struct, which starts at `base`. */
  at(base: number, index: number): Values<F>;

  /** Copies the struct to a plain object. */
  snapshot(address: number): Values<F>;

  /** Writes the fields that are given, and leaves the others as they are. */
  assign(address: number, values: Partial<Values<F>>): void;

  /** Allocates room for the struct on the stack, and writes the values to it if they are given. */
  allocate(stack: Stack, values?: Partial<Values<F>>): number;

  /** Runs a call of Core that returns the struct through a pointer, and returns what it wrote. */
  returning(call: (address: number) => void): Values<F>;

  /** Runs a body with a copy of the value, which is how Core takes a struct by value. */
  passing<R>(values: Partial<Values<F>>, body: (address: number) => R): R;
}

/**
 * Describes a struct of C. The fields are in the order of the members, and are placed as a
 * compiler does on a 32-bit target: each one at a multiple of its alignment, and the size is a
 * multiple of the greatest alignment. The layout is compared with the one that the compiler made
 * by a test, so a field that is wrong does not go unnoticed.
 */
export function struct<const F extends Fields>(fields: F): StructType<F> {
  return build(fields, false);
}

/** Describes a union of C, whose members all start at its address. */
export function union<const F extends Fields>(members: F): StructType<F> {
  return build(members, true);
}

function build<F extends Fields>(fields: F, isUnion: boolean): StructType<F> {
  const names = Object.keys(fields) as (keyof F & string)[];
  const offsets = {} as { [K in keyof F]: number };
  let end = 0;
  let alignment = 1;

  for (const name of names) {
    const field = fields[name] as Field<unknown>;
    const offset = isUnion ? 0 : Math.ceil(end / field.alignment) * field.alignment;
    offsets[name] = offset;
    end = isUnion ? Math.max(end, field.size) : offset + field.size;
    alignment = Math.max(alignment, field.alignment);
  }
  const size = Math.ceil(end / alignment) * alignment;

  // One class for each struct, whose properties are the accessors of the fields.
  class View {
    constructor(readonly address: number) {}
  }
  for (const name of names) {
    const field = fields[name] as Field<unknown>;
    const offset = offsets[name];
    Object.defineProperty(View.prototype, name, {
      get(this: View) {
        return field.read(this.address + offset);
      },
      set(this: View, value: unknown) {
        field.write(this.address + offset, value);
      },
      enumerable: true,
    });
  }

  const type: StructType<F> = {
    size,
    alignment,
    offsets,
    view: (address) => new View(address) as unknown as Values<F>,
    at: (base, index) => new View(base + index * size) as unknown as Values<F>,
    // A field of another struct reads as a view, as a view does not copy what it does not need.
    read: (address) => new View(address) as unknown as Values<F>,
    write: (address, values) => type.assign(address, values),
    snapshot(address) {
      const values = {} as Record<string, unknown>;
      for (const name of names) {
        values[name] = (fields[name] as Field<unknown>).read(address + offsets[name]);
      }
      return values as Values<F>;
    },
    assign(address, values) {
      for (const name of names) {
        const value = (values as Record<string, unknown>)[name];
        if (value !== undefined) {
          (fields[name] as Field<unknown>).write(address + offsets[name], value);
        }
      }
    },
    allocate(stack, values) {
      const address = stack.alloc(size);
      if (values !== undefined) {
        type.assign(address, values);
      }
      return address;
    },
    returning(call) {
      return withStack((stack) => {
        const address = stack.alloc(size);
        call(address);
        return type.snapshot(address);
      });
    },
    passing(values, body) {
      return withStack((stack) => body(type.allocate(stack, values)));
    },
  };
  return type;
}

/** Runs a body with the numbers copied to the memory of the module, which is freed after. */
export function withValues<T>(field: Field<number>, values: ArrayLike<number>, body: (pointer: number) => T): T {
  const pointer = malloc(values.length * field.size);
  try {
    for (let index = 0; index < values.length; index++) {
      field.write(pointer + index * field.size, values[index] ?? 0);
    }
    return body(pointer);
  } finally {
    free(pointer);
  }
}
