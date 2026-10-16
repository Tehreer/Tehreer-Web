import { checkElement, checkRange } from "../internal/Validation.js";
import type { NumberKind, TypedArrays } from "./NumberKind.js";

/**
 * A list that can be read but not changed, which has its elements wherever they are kept: many of
 * them are in the memory of Core, and are converted when they are read, so that making a list
 * costs nothing and an element that is never read is never converted.
 *
 * The elements of a list that belongs to an object are valid while the object is not disposed.
 */
export abstract class List<T> implements Iterable<T> {
  /** The number of elements. */
  abstract readonly length: number;

  /**
   * Returns the element at an index.
   *
   * @throws {RangeError} If the index is not of an element.
   */
  abstract get(index: number): T;

  /** Returns a view of the elements from `fromIndex` up to `toIndex`, which are all by default. */
  abstract slice(fromIndex?: number, toIndex?: number): List<T>;

  /** Returns the element at an index, which counts from the end if it is negative, or `undefined`. */
  at(index: number): T | undefined {
    const position = index < 0 ? this.length + index : index;
    return position >= 0 && position < this.length ? this.get(position) : undefined;
  }

  get isEmpty(): boolean {
    return this.length === 0;
  }

  /** Converts all elements to an array. */
  toArray(): T[] {
    const array: T[] = [];
    for (let index = 0; index < this.length; index++) {
      array.push(this.get(index));
    }
    return array;
  }

  forEach(body: (element: T, index: number) => void): void {
    for (let index = 0; index < this.length; index++) {
      body(this.get(index), index);
    }
  }

  map<R>(transform: (element: T, index: number) => R): R[] {
    const result: R[] = [];
    this.forEach((element, index) => result.push(transform(element, index)));
    return result;
  }

  reduce<R>(combine: (accumulator: R, element: T, index: number) => R, initial: R): R {
    let accumulator = initial;
    this.forEach((element, index) => {
      accumulator = combine(accumulator, element, index);
    });
    return accumulator;
  }

  find(test: (element: T, index: number) => boolean): T | undefined {
    const index = this.findIndex(test);
    return index < 0 ? undefined : this.get(index);
  }

  findIndex(test: (element: T, index: number) => boolean): number {
    for (let index = 0; index < this.length; index++) {
      if (test(this.get(index), index)) {
        return index;
      }
    }
    return -1;
  }

  some(test: (element: T, index: number) => boolean): boolean {
    return this.findIndex(test) >= 0;
  }

  every(test: (element: T, index: number) => boolean): boolean {
    return this.findIndex((element, index) => !test(element, index)) < 0;
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let index = 0; index < this.length; index++) {
      yield this.get(index);
    }
  }

  protected checkIndex(index: number): void {
    checkElement("index", index, this.length);
  }

  protected checkSlice(fromIndex: number, toIndex: number): void {
    checkRange(fromIndex, toIndex, this.length);
  }
}

/**
 * A list of numbers of a kind (`Float`, `UInt16`, …), which can be copied to the typed array of
 * that kind in one go.
 */
export interface NumberList<K extends NumberKind> extends List<number> {
  slice(fromIndex?: number, toIndex?: number): NumberList<K>;

  /** Copies all of the numbers to a new typed array. */
  toTypedArray(): TypedArrays[K];
}

/** A list of points, which can be copied to a typed array of the pairs `x0, y0, x1, y1, …`. */
export interface PointList extends List<{ readonly x: number; readonly y: number }> {
  slice(fromIndex?: number, toIndex?: number): PointList;

  /** Copies all of the points to a new array of their coordinates, as the pairs `x, y`. */
  toFloat32Array(): Float32Array;
}
