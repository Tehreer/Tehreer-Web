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

import { adopt } from "../internal/Adopt.js";
import { callingBack } from "../internal/Callbacks.js";
import { NativeObject } from "../internal/NativeObject.js";
import {
  StringEncodingUTF16, free, malloc, readCodeUnits, withStack, withUtf16,
} from "../internal/Memory.js";
import { TRRange } from "../internal/Structs.js";
import { Module } from "../internal/Module.js";
import { u32 } from "../internal/Struct.js";
import { checkCreated, checkOrderedRange, checkRange } from "../internal/Validation.js";
import { BoundaryDirection, BoundaryType, BreakMode, TruncationPlace } from "./enums.js";
import { ComposedLine } from "./ComposedLine.js";
import { readAttributeList, withDefaultAttributes } from "./TextAttributeCodec.js";
import type { TextAttributeRun, TextAttributes } from "./TextAttributes.js";
import type { MutableTypesetter } from "./MutableTypesetter.js";

const releaseLine = (line: number): void => Module._TRComposedLineRelease(line);

/** A range of code units, from `startIndex` up to but not including `endIndex`. */
export interface CodeUnitRange {
  readonly startIndex: number;
  readonly endIndex: number;
}

/**
 * Holds a text with attributes on its ranges, shapes it, and breaks it into lines. The code units
 * are UTF-16, so the indices are the indices of a JavaScript string. Each paragraph is shaped when
 * it is made or changed, so lines can be made over and over again for different ranges and
 * extents.
 *
 * A typesetter is immutable and thread safe; `MutableTypesetter` is the editable kind.
 */
export class Typesetter extends NativeObject {
  /**
   * Makes a typesetter of a string, which has no attributes.
   *
   * @param text The string of the text.
   * @param defaultAttributes The attributes to use where the text sets none. Only those that
   *     decide how text is shaped are looked at: the typeface, type size, scales, baseline offset,
   *     obliqueness, replacement, language tag and font features. A typeface has to be given by
   *     them, or by the attributes of the text, for every part that is not a replacement, or no
   *     line can be made over that part.
   * @throws {Error} If the typesetter could not be created.
   */
  constructor(text: string, defaultAttributes?: TextAttributes);
  /** @internal */
  constructor(token: typeof adopt, handle: number);
  constructor(text: string | typeof adopt, defaultAttributes: TextAttributes | number = {}) {
    super(
      text === adopt
        ? (defaultAttributes as number)
        : checkCreated(
            withUtf16(text, (units, length) =>
              withDefaultAttributes(defaultAttributes as TextAttributes, (memory, count) =>
                callingBack(
                  () => Module._TRTypesetterCreate(units, length, StringEncodingUTF16, memory, count),
                  (created) => Module._TRTypesetterRelease(created),
                ),
              ),
            ),
            "a typesetter",
          ),
      (h) => Module._TRTypesetterRelease(h),
    );
  }

  /** Makes a wrapper for a typesetter that Core does not retain for the caller. @internal */
  static retaining(handle: number): Typesetter {
    return new Typesetter(adopt, Module._TRTypesetterRetain(handle));
  }

  /** The number of code units. */
  get length(): number {
    return Module._TRTypesetterGetLength(this.nativeHandle);
  }

  /** The code units as a string. */
  get string(): string {
    return this.getString(0, this.length);
  }

  /**
   * Copies the code units from `fromIndex` up to `toIndex` as a string.
   *
   * @throws {RangeError} If the range is not within the text.
   */
  getString(fromIndex: number, toIndex: number): string {
    const handle = this.nativeHandle;
    checkRange(fromIndex, toIndex, Module._TRTypesetterGetLength(handle));

    const length = toIndex - fromIndex;
    if (length === 0) {
      return "";
    }
    const buffer = malloc(length * 2);
    try {
      if (Module._TRTypesetterGetCodeUnits(handle, fromIndex, length, buffer) === 0) {
        throw new Error("Could not copy the code units.");
      }
      return readCodeUnits(buffer, length, StringEncodingUTF16);
    } finally {
      free(buffer);
    }
  }

  /**
   * Returns the attributes that are set at an index, and how long they stay the same.
   *
   * @returns The attributes, or `undefined` if the index is not less than the length.
   */
  getAttributeRun(index: number): TextAttributeRun | undefined {
    const handle = this.nativeHandle;
    return withStack((stack) => {
      const outLength = stack.alloc(4);
      const list = Module._TRTypesetterCopyAttributes(handle, index, outLength);
      if (list === 0) {
        return undefined;
      }
      try {
        return { attributes: readAttributeList(list), length: u32.read(outLength) };
      } finally {
        Module._TRAttributeListRelease(list);
      }
    });
  }

  /** Makes an immutable copy, which has the attributes too. It shares the shaping, so it costs little. */
  copy(): Typesetter {
    return new Typesetter(
      adopt,
      checkCreated(Module._TRTypesetterCreateCopy(this.nativeHandle), "a copy of the typesetter (is it being edited?)"),
    );
  }

  /** Makes a copy that can be edited, which has the attributes too. */
  mutableCopy(): MutableTypesetter {
    return makeMutable(
      checkCreated(Module._TRTypesetterCreateMutableCopy(this.nativeHandle), "a mutable copy of the typesetter (is it being edited?)"),
    );
  }

  /**
   * Finds the boundary of a type that is next to an index, by Unicode Standard Annex #29 for
   * graphemes and words, and by the separators of the text for paragraphs. The start and the end
   * of the text are boundaries of every type. It needs no typeface.
   *
   * @param index The index to search from, which can be the length of the text.
   * @returns The index of the boundary, or -1 if the index is past the end of the text, there is
   *     none in that direction, or the typesetter is being edited.
   */
  findBoundary(index: number, type: BoundaryType, direction: BoundaryDirection): number {
    const handle = this.nativeHandle;
    checkOrderedRange(0, index);
    return Module._TRTypesetterFindBoundary(handle, index, type, direction) | 0;
  }

  /**
   * Gets the range of the segment of a boundary type that contains an index, such as the word
   * under a caret.
   *
   * @param index The index that the segment contains, which can be the length of the text and has
   *     an empty segment.
   * @returns The range, or `undefined` if the index is past the end of the text, or the typesetter
   *     is being edited.
   */
  getBoundaryRange(index: number, type: BoundaryType): CodeUnitRange | undefined {
    const handle = this.nativeHandle;
    checkOrderedRange(0, index);
    const range = TRRange.returning((ret) => Module._TRTypesetterGetBoundaryRange(ret, handle, index, type));
    if ((range.index | 0) === -1) {
      return undefined;
    }
    return { startIndex: range.index, endIndex: range.index + range.length };
  }

  override toString(): string {
    return this.string;
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
    const line = callingBack(
      () => Module._TRTypesetterCreateSimpleLine(handle, fromIndex, toIndex - fromIndex, layoutWidth),
      releaseLine,
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
      callingBack(
        () =>
          Module._TRTypesetterCreateTruncationToken(
            handle, fromIndex, toIndex - fromIndex, place, units, length, StringEncodingUTF16),
        releaseLine,
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
    const line = callingBack(
      () =>
        Module._TRTypesetterCreateTruncatedLine(
          handle, fromIndex, toIndex - fromIndex, extent, breakMode, place, tokenLine.nativeHandle),
      releaseLine,
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
    const line = callingBack(
      () =>
        Module._TRTypesetterCreateJustifiedLine(
          handle, fromIndex, toIndex - fromIndex, justificationFactor, justificationExtent),
      releaseLine,
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

// The mutable typesetter is a subclass, so it registers how to wrap a handle here, once it is defined.
let makeMutable: (handle: number) => MutableTypesetter = () => {
  throw new Error("MutableTypesetter is not loaded.");
};

/** @internal */
export function setMutableTypesetterFactory(factory: (handle: number) => MutableTypesetter): void {
  makeMutable = factory;
}
