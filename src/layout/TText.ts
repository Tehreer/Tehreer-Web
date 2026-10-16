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
import { NativeObject } from "../internal/NativeObject.js";
import { free, malloc, readCodeUnits, StringEncodingUTF16, withStack, withUtf16 } from "../internal/Memory.js";
import { Module } from "../internal/Module.js";
import { checkCreated, checkRange } from "../internal/Validation.js";
import { u32 } from "../internal/Struct.js";
import { readAttributeList } from "./TextAttributeCodec.js";
import type { TextAttributeRun } from "./TextAttributes.js";
import type { TMutableText } from "./TMutableText.js";

/**
 * Text with attributes on its ranges. The code units are UTF-16, so the indices are the indices
 * of a JavaScript string.
 *
 * A text is immutable and thread safe; `TMutableText` is the editable kind.
 */
export class TText extends NativeObject {
  /** Makes a text of a string, which has no attributes. */
  constructor(text: string);
  /** @internal */
  constructor(token: typeof adopt, handle: number);
  constructor(text: string | typeof adopt, handle?: number) {
    super(
      text === adopt
        ? (handle as number)
        : checkCreated(
            withUtf16(text, (units, length) => Module._TRTextCreate(units, length, StringEncodingUTF16)),
            "a text",
          ),
      (h) => Module._TRTextRelease(h),
    );
  }

  /** The number of code units. */
  get length(): number {
    return Module._TRTextGetLength(this.nativeHandle);
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
    checkRange(fromIndex, toIndex, Module._TRTextGetLength(handle));

    const length = toIndex - fromIndex;
    if (length === 0) {
      return "";
    }
    const buffer = malloc(length * 2);
    try {
      if (Module._TRTextGetCodeUnits(handle, fromIndex, length, buffer) === 0) {
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
      const list = Module._TRTextCopyAttributes(handle, index, outLength);
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

  /** Makes an immutable copy, which has the attributes too. */
  copy(): TText {
    return new TText(adopt, checkCreated(Module._TRTextCreateCopy(this.nativeHandle), "a copy of the text"));
  }

  /** Makes a copy that can be edited. */
  mutableCopy(): TMutableText {
    return makeMutable(checkCreated(Module._TRTextCreateMutableCopy(this.nativeHandle), "a mutable copy"));
  }

  override toString(): string {
    return this.string;
  }
}

// The mutable text is a subclass, so it registers how to wrap a handle here, once it is defined.
let makeMutable: (handle: number) => TMutableText = () => {
  throw new Error("TMutableText is not loaded.");
};

/** @internal */
export function setMutableTextFactory(factory: (handle: number) => TMutableText): void {
  makeMutable = factory;
}
