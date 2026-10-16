import type { UInt8 } from "../collections/NumberKind.js";
import { coreNumbers } from "../collections/CoreList.js";
import type { NumberList } from "../collections/List.js";
import { withStack } from "../internal/Memory.js";
import { Module } from "../internal/Module.js";
import { NativeObject } from "../internal/NativeObject.js";
import { u32, u8 } from "../internal/Struct.js";
import { checkCreated } from "../internal/Validation.js";
import { BaseDirection, MAX_BIDI_LEVEL } from "./BaseDirection.js";
import { BidiBuffer, withCodepointSequence } from "./BidiBuffer.js";
import { BidiParagraph } from "./BidiParagraph.js";

/** Applies the Unicode Bidirectional Algorithm on a text. */
export class BidiAlgorithm extends NativeObject {
  readonly #buffer: BidiBuffer;

  /** The greatest explicit embedding level. */
  static readonly MAX_LEVEL = MAX_BIDI_LEVEL;

  /**
   * Makes a bidi algorithm object for a text.
   *
   * @throws {RangeError} If the text is empty.
   */
  constructor(text: string) {
    if (text.length === 0) {
      throw new RangeError("Text is empty.");
    }

    const buffer = BidiBuffer.create(text);
    const handle = withCodepointSequence(buffer.address, buffer.length, (sequence) =>
      Module._SBAlgorithmCreate(sequence),
    );
    if (handle === 0) {
      buffer.release();
    }
    checkCreated(handle, "a bidi algorithm");

    super(handle, (h) => {
      Module._SBAlgorithmRelease(h);
      buffer.release();
    });
    this.#buffer = buffer;
  }

  /** The bidi class of each character of the text, which is valid while the algorithm is not disposed. */
  get charBidiClasses(): NumberList<UInt8> {
    return coreNumbers(this, Module._SBAlgorithmGetBidiTypesPtr(this.nativeHandle), this.#buffer.length, u8);
  }

  /**
   * Finds the boundary of the first paragraph in a range of the text.
   *
   * The boundary comes after a character whose bidi class is Paragraph Separator, or at `toIndex`
   * if there is none before it. A carriage return that is followed by a line feed is the
   * exception: the boundary comes after both.
   *
   * @param fromIndex The index of the first character of the paragraph in the source text.
   * @param toIndex The suggested index after the last character of the paragraph.
   * @returns The index after the last character of the paragraph.
   * @throws {RangeError} If the range is empty or not inside of the text.
   */
  getParagraphBoundary(fromIndex: number, toIndex: number): number {
    const handle = this.nativeHandle;
    this.#checkSubRange(fromIndex, toIndex);

    return withStack((stack) => {
      const actualLength = stack.alloc(u32.size);
      Module._SBAlgorithmGetParagraphBoundary(handle, fromIndex, toIndex - fromIndex, actualLength, 0);
      return fromIndex + u32.read(actualLength);
    });
  }

  /**
   * Makes the first paragraph that starts at `fromIndex` and ends at `toIndex` or before it, as
   * the rule P1 says. The base level is found by the rules P2 and P3, or it is the one that is
   * given, and the embedding levels are resolved by the rules X1 to I2.
   *
   * @param fromIndex The index of the first character of the paragraph in the source text.
   * @param toIndex The suggested index after the last character of the paragraph.
   * @param base A base direction, or a base level from 0 up to {@link BidiAlgorithm.MAX_LEVEL}.
   * @throws {RangeError} If the range is empty or not inside of the text, or the base is not valid.
   */
  createParagraph(fromIndex: number, toIndex: number, base: BaseDirection | number): BidiParagraph {
    const handle = this.nativeHandle;
    this.#checkSubRange(fromIndex, toIndex);
    if (
      !Number.isInteger(base) ||
      !(base === BaseDirection.DefaultLeftToRight || base === BaseDirection.DefaultRightToLeft || (base >= 0 && base <= MAX_BIDI_LEVEL))
    ) {
      throw new RangeError(`The base (${base}) is neither a base direction nor a level from 0 to ${MAX_BIDI_LEVEL}.`);
    }

    const paragraph = checkCreated(
      Module._SBAlgorithmCreateParagraph(handle, fromIndex, toIndex - fromIndex, base),
      "a bidi paragraph",
    );
    return BidiParagraph.adopting(paragraph, this.#buffer.retain());
  }

  #checkSubRange(fromIndex: number, toIndex: number): void {
    const length = this.#buffer.length;
    if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) || fromIndex < 0 || toIndex > length || toIndex <= fromIndex) {
      throw new RangeError(`The range ${fromIndex}..${toIndex} is not a range inside of the text 0..${length}.`);
    }
  }
}
