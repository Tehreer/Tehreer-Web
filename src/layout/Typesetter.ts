import { adopt } from "../internal/Adopt.js";
import { callingBack } from "../internal/Callbacks.js";
import { NativeObject } from "../internal/NativeObject.js";
import { StringEncodingUTF16, calloc, free, withUtf16 } from "../internal/Memory.js";
import { TRAttribute } from "../internal/Structs.js";
import { Module } from "../internal/Module.js";
import { checkCreated, checkOrderedRange } from "../internal/Validation.js";
import type { FontFeatures } from "../sfnt/FontFeatures.js";
import { BreakMode, TruncationPlace } from "./enums.js";
import { ComposedLine } from "./ComposedLine.js";
import { attributeNames, writeAttribute } from "./TextAttributeCodec.js";
import type { TextAttributes } from "./TextAttributes.js";
import { TText } from "./TText.js";

/**
 * Shapes text and breaks it into lines. It copies the text, so the text can be changed or
 * disposed after the typesetter is made. A typesetter is immutable and thread safe.
 */
export class Typesetter extends NativeObject {
  /**
   * Makes a typesetter for a text.
   *
   * @param text The text to typeset. A string has no attributes, so the defaults have to give it
   *     a typeface.
   * @param defaultAttributes The attributes to use where the text sets none. Only those that
   *     decide how text is shaped are looked at: the typeface, type size, scales, baseline offset,
   *     obliqueness, replacement, language tag and font features. A typeface has to be given by
   *     the text or by them for every part that is not a replacement.
   * @throws {Error} If some text has no typeface.
   */
  constructor(text: TText | string, defaultAttributes?: TextAttributes);
  /** @internal */
  constructor(token: typeof adopt, handle: number);
  constructor(text: TText | string | typeof adopt, defaultAttributes: TextAttributes | number = {}) {
    super(
      text === adopt ? (defaultAttributes as number) : Typesetter.#create(text, defaultAttributes as TextAttributes),
      (h) => Module._TRTypesetterRelease(h),
    );
  }

  /** Makes a wrapper for a typesetter that Core does not retain for the caller. @internal */
  static retaining(handle: number): Typesetter {
    return new Typesetter(adopt, Module._TRTypesetterRetain(handle));
  }

  static #create(text: TText | string, defaults: TextAttributes): number {
    const own = typeof text === "string" ? new TText(text) : undefined;
    const source = own ?? (text as TText);
    const names = attributeNames(defaults);
    const memory = calloc(Math.max(names.length, 1) * TRAttribute.size);
    const temporaries: (FontFeatures | undefined)[] = [];
    try {
      names.forEach((name, index) => {
        temporaries.push(writeAttribute(memory + index * TRAttribute.size, name, defaults[name]));
      });
      return checkCreated(
        callingBack(() => Module._TRTypesetterCreate(source.nativeHandle, memory, names.length)),
        "a typesetter (does all of the text have a typeface?)",
      );
    } finally {
      free(memory);
      own?.dispose();
      for (const temporary of temporaries) {
        temporary?.dispose();
      }
    }
  }

  /** The number of code units of the text. */
  get codeUnitCount(): number {
    return Module._TRTypesetterGetCodeUnitCount(this.nativeHandle);
  }

  /**
   * Suggests where to break the code units from `fromIndex` up to `toIndex` so that the line
   * fits in an extent, searching forward from the start.
   *
   * @returns The index after the last code unit that fits, which is at least one more than
   *     `fromIndex` for a range that is not empty.
   * @throws {RangeError} If the range is empty or is not within the text.
   */
  suggestForwardBreak(fromIndex: number, toIndex: number, extent: number, breakMode: BreakMode): number {
    const handle = this.nativeHandle;
    checkOrderedRange(fromIndex, toIndex);
    return checkBreak(
      callingBack(() =>
        Module._TRTypesetterSuggestForwardBreak(handle, fromIndex, toIndex - fromIndex, extent, breakMode),
      ),
    );
  }

  /** Suggests where to break so that the line fits in an extent, searching backward from the end. */
  suggestBackwardBreak(fromIndex: number, toIndex: number, extent: number, breakMode: BreakMode): number {
    const handle = this.nativeHandle;
    checkOrderedRange(fromIndex, toIndex);
    return checkBreak(
      callingBack(() =>
        Module._TRTypesetterSuggestBackwardBreak(handle, fromIndex, toIndex - fromIndex, extent, breakMode),
      ),
    );
  }

  /**
   * Makes a line of the code units from `fromIndex` up to `toIndex`.
   *
   * @param layoutWidth The width that block replacements are laid out for. It is 0 by default.
   */
  createSimpleLine(fromIndex: number, toIndex: number, layoutWidth = 0): ComposedLine {
    const handle = this.nativeHandle;
    checkOrderedRange(fromIndex, toIndex);
    const line = callingBack(() =>
      Module._TRTypesetterCreateSimpleLine(handle, fromIndex, toIndex - fromIndex, layoutWidth),
    );
    return ComposedLine.adopting(checkLine(line, "a line"));
  }

  /**
   * Makes the line of the token that shows in place of the text that a truncated line cuts out.
   *
   * @param fromIndex The first code unit of the range that is truncated.
   * @param token The string of the token, which takes the attributes of the code unit that it
   *     stands for.
   */
  createTruncationToken(fromIndex: number, toIndex: number, place: TruncationPlace, token: string): ComposedLine {
    const handle = this.nativeHandle;
    checkOrderedRange(fromIndex, toIndex);
    const line = withUtf16(token, (units, length) =>
      callingBack(() =>
        Module._TRTypesetterCreateTruncationToken(
          handle, fromIndex, toIndex - fromIndex, place, units, length, StringEncodingUTF16),
      ),
    );
    return ComposedLine.adopting(checkLine(line, "a truncation token"));
  }

  /**
   * Makes a line of a range that is not empty, cutting out the part that does not fit in the
   * extent and showing a token instead. A line that fits is made as `createSimpleLine()` makes it.
   * The range of the line is the whole range, including the text that was cut out.
   *
   * @param tokenLine The line of the token, such as one from `createTruncationToken()`.
   */
  createTruncatedLine(
    fromIndex: number,
    toIndex: number,
    extent: number,
    breakMode: BreakMode,
    place: TruncationPlace,
    tokenLine: ComposedLine,
  ): ComposedLine {
    const handle = this.nativeHandle;
    this.#checkNonEmptyRange(fromIndex, toIndex);
    const line = callingBack(() =>
      Module._TRTypesetterCreateTruncatedLine(
        handle, fromIndex, toIndex - fromIndex, extent, breakMode, place, tokenLine.nativeHandle),
    );
    return ComposedLine.adopting(checkLine(line, "a truncated line"));
  }

  /**
   * Makes a line of a range that is not empty, stretched to an extent by adding space to its
   * inner spaces.
   *
   * @param justificationFactor How much of the extra space is used: 1 or more stretches the line
   *     fully, anything less does it partially, and 0 or less leaves it as it is.
   * @param justificationExtent The extent to stretch the line to. The spaces are squeezed if it is
   *     less than the width of the line.
   */
  createJustifiedLine(
    fromIndex: number,
    toIndex: number,
    justificationFactor: number,
    justificationExtent: number,
  ): ComposedLine {
    const handle = this.nativeHandle;
    this.#checkNonEmptyRange(fromIndex, toIndex);
    const line = callingBack(() =>
      Module._TRTypesetterCreateJustifiedLine(
        handle, fromIndex, toIndex - fromIndex, justificationFactor, justificationExtent),
    );
    return ComposedLine.adopting(checkLine(line, "a justified line"));
  }

  #checkNonEmptyRange(fromIndex: number, toIndex: number): void {
    checkOrderedRange(fromIndex, toIndex);
    if (fromIndex === toIndex) {
      throw new RangeError("The range must not be empty.");
    }
  }
}

/** Core gives no index for a range that is empty or is not within the text. */
function checkBreak(index: number): number {
  if (index === -1) {
    throw new RangeError("The range is empty or is not within the text.");
  }
  return index;
}

/** Core gives no line for a range that is not within the text, and for a failure. */
function checkLine(handle: number, what: string): number {
  if (handle === 0) {
    throw new RangeError(`Could not create ${what}: is the range within the text?`);
  }
  return handle;
}
