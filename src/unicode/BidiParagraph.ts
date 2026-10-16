import type { UInt8 } from "../collections/NumberKind.js";
import { coreNumbers } from "../collections/CoreList.js";
import type { NumberList } from "../collections/List.js";
import { adopt } from "../internal/Adopt.js";
import { Module } from "../internal/Module.js";
import { NativeObject } from "../internal/NativeObject.js";
import { u8 } from "../internal/Struct.js";
import { checkCreated, checkOrderedRange } from "../internal/Validation.js";
import { BidiBuffer } from "./BidiBuffer.js";
import { BidiLine } from "./BidiLine.js";
import { BidiRun } from "./BidiRun.js";

/** A paragraph of text, processed with the rules of the Unicode Bidirectional Algorithm. */
export class BidiParagraph extends NativeObject {
  readonly #buffer: BidiBuffer;

  /** @internal */
  constructor(token: typeof adopt, handle: number, buffer: BidiBuffer) {
    super(handle, (h) => {
      Module._SBParagraphRelease(h);
      buffer.release();
    });
    void token;
    this.#buffer = buffer;
  }

  /** @internal */
  static adopting(handle: number, buffer: BidiBuffer): BidiParagraph {
    return new BidiParagraph(adopt, handle, buffer);
  }

  /** The index of the first character of the paragraph in the source text. */
  get startIndex(): number {
    return Module._SBParagraphGetOffset(this.nativeHandle);
  }

  /** The index after the last character of the paragraph in the source text. */
  get endIndex(): number {
    const handle = this.nativeHandle;
    return Module._SBParagraphGetOffset(handle) + Module._SBParagraphGetLength(handle);
  }

  /** The base level of the paragraph. */
  get baseLevel(): number {
    return Module._SBParagraphGetBaseLevel(this.nativeHandle);
  }

  /** The embedding level of each character of the paragraph, which is valid while it is not disposed. */
  get charLevels(): NumberList<UInt8> {
    const handle = this.nativeHandle;
    return coreNumbers(this, Module._SBParagraphGetLevelsPtr(handle), Module._SBParagraphGetLength(handle), u8);
  }

  /** The runs of the paragraph in their logical order. The paragraph must not be disposed while they are iterated. */
  get logicalRuns(): Iterable<BidiRun> {
    return { [Symbol.iterator]: () => this.#logicalRuns() };
  }

  *#logicalRuns(): Generator<BidiRun> {
    const start = this.startIndex;
    const levels = this.charLevels;
    let index = 0;
    while (index < levels.length) {
      const level = levels.get(index);
      let next = index + 1;
      while (next < levels.length && levels.get(next) === level) {
        next++;
      }
      yield new BidiRun(start + index, start + next, level);
      index = next;
    }
  }

  /**
   * Makes a line of the paragraph by applying the rules L1 and L2 of the Unicode Bidirectional
   * Algorithm.
   *
   * @param fromIndex The index of the first character of the line in the source text.
   * @param toIndex The index after the last character of the line in the source text.
   * @throws {RangeError} If the range is empty or not inside of the paragraph.
   */
  createLine(fromIndex: number, toIndex: number): BidiLine {
    checkOrderedRange(fromIndex, toIndex);
    const handle = this.nativeHandle;
    const start = Module._SBParagraphGetOffset(handle);
    const end = start + Module._SBParagraphGetLength(handle);
    if (fromIndex < start || toIndex > end || toIndex <= fromIndex) {
      throw new RangeError(`The range ${fromIndex}..${toIndex} is not a range inside of the paragraph ${start}..${end}.`);
    }

    const line = checkCreated(Module._SBParagraphCreateLine(handle, fromIndex, toIndex - fromIndex), "a bidi line");
    return BidiLine.adopting(line, this.#buffer.retain());
  }
}
