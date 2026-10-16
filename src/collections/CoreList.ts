import type { NativeObject } from "../internal/NativeObject.js";
import { f32, type NumberField } from "../internal/Struct.js";
import { TRPoint } from "../internal/Structs.js";
import type { NumberKind } from "./NumberKind.js";
import { List, type NumberList, type PointList } from "./List.js";

/**
 * How the elements of a buffer of Core are read. A number field or a struct is one: it says how
 * big an element is, and how to read it from an address.
 */
export interface ElementReader<T> {
  readonly size: number;
  read(address: number): T;
  /** Copies consecutive elements to a typed array, for the elements that have a raw form. */
  copy?(address: number, count: number): ArrayBufferView;
}

/** The reader of the points of Core, which are pairs of floats. */
export const pointReader: ElementReader<{ readonly x: number; readonly y: number }> = {
  size: TRPoint.size,
  read: (address) => TRPoint.snapshot(address),
  copy: (address, count) => f32.copy(address, count * 2),
};

/**
 * The elements of a buffer that Core owns, which are read from its memory when they are asked for.
 * The owner keeps the buffer alive in Core, so the list checks that it is not disposed each time
 * that it reads.
 *
 * @internal
 */
export class CoreList<T> extends List<T> {
  readonly #owner: NativeObject;
  readonly #pointer: number;
  readonly #element: ElementReader<T>;
  readonly length: number;

  constructor(owner: NativeObject, pointer: number, length: number, element: ElementReader<T>) {
    super();
    this.#owner = owner;
    this.#pointer = pointer;
    this.length = length;
    this.#element = element;
  }

  /** The address of the first element, if the owner is not disposed. */
  get address(): number {
    // Reading the handle of a disposed object fails with a message that says so.
    void this.#owner.nativeHandle;
    return this.#pointer;
  }

  /** The reader of the elements, which tells whether another list has the same kind of them. */
  get element(): ElementReader<T> {
    return this.#element;
  }

  get(index: number): T {
    this.checkIndex(index);
    return this.#element.read(this.address + index * this.#element.size);
  }

  slice(fromIndex = 0, toIndex: number = this.length): CoreList<T> {
    this.checkSlice(fromIndex, toIndex);
    return new CoreList(this.#owner, this.#pointer + fromIndex * this.#element.size, toIndex - fromIndex, this.#element);
  }

  toTypedArray(): ArrayBufferView {
    return this.#copy();
  }

  toFloat32Array(): Float32Array {
    return this.#copy() as Float32Array;
  }

  #copy(): ArrayBufferView {
    if (this.#element.copy === undefined) {
      throw new TypeError("The elements of this list are not numbers.");
    }
    return this.#element.copy(this.address, this.length);
  }
}

/** Makes a list of the numbers of a buffer of Core. @internal */
export function coreNumbers<K extends NumberKind>(
  owner: NativeObject,
  pointer: number,
  length: number,
  field: NumberField<K>,
): NumberList<K> {
  return new CoreList<number>(owner, pointer, length, field) as unknown as NumberList<K>;
}

/** Makes a list of the points of a buffer of Core. @internal */
export function corePoints(owner: NativeObject, pointer: number, length: number): PointList {
  return new CoreList(owner, pointer, length, pointReader) as unknown as PointList;
}

/**
 * The elements that are made by a function from their index, such as the runs of a line. Their
 * number is known when the list is made, as the objects of Core do not change.
 *
 * @internal
 */
export class IndexedList<T> extends List<T> {
  readonly #owner: NativeObject;
  readonly #item: (index: number) => T;
  readonly #offset: number;
  readonly length: number;

  constructor(owner: NativeObject, length: number, item: (index: number) => T, offset = 0) {
    super();
    this.#owner = owner;
    this.length = length;
    this.#item = item;
    this.#offset = offset;
  }

  get(index: number): T {
    this.checkIndex(index);
    void this.#owner.nativeHandle;
    return this.#item(this.#offset + index);
  }

  slice(fromIndex = 0, toIndex: number = this.length): IndexedList<T> {
    this.checkSlice(fromIndex, toIndex);
    return new IndexedList(this.#owner, toIndex - fromIndex, this.#item, this.#offset + fromIndex);
  }
}

/**
 * Finds out whether the list reads numbers of a kind from the memory of Core, which a function
 * of Core can use as it is. It gives the address of the first number and their count.
 *
 * @internal
 */
export function coreBufferOf(list: unknown, element: ElementReader<unknown>): { address: number; length: number } | undefined {
  if (list instanceof CoreList && list.element === element) {
    return { address: list.address, length: list.length };
  }
  return undefined;
}


