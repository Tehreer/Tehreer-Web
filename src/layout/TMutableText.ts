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
import { TRAttribute } from "../internal/Structs.js";
import { StringEncodingUTF16, withStack, withUtf16 } from "../internal/Memory.js";
import { Module } from "../internal/Module.js";
import { checkCreated, checkIndex, checkRange } from "../internal/Validation.js";
import { attributeNames, attributeType, writeAttribute } from "./TextAttributeCodec.js";
import type { TextAttributeName, TextAttributes } from "./TextAttributes.js";
import { setMutableTextFactory, TText } from "./TText.js";

/**
 * Text that can be edited. A range that an edit puts in takes the attributes of what it replaces.
 *
 * A mutable text is not thread safe. Take a copy with `copy()` to lay it out while it is edited.
 */
export class TMutableText extends TText {
  /** Makes a mutable text, which starts with the string if there is one. */
  constructor(text?: string);
  /** @internal */
  constructor(token: typeof adopt, handle: number);
  constructor(text?: string | typeof adopt, handle?: number) {
    if (text === adopt) {
      super(adopt, handle as number);
    } else {
      super(adopt, checkCreated(Module._TRTextCreateMutable(StringEncodingUTF16), "a mutable text"));
      if (text !== undefined && text.length > 0) {
        this.append(text);
      }
    }
  }

  /**
   * Starts a batch of edits, whose analysis is deferred until `endEditing()`. Batches do not nest.
   */
  beginEditing(): void {
    Module._TRTextBeginEditing(this.nativeHandle);
  }

  /** Ends a batch of edits, and analyzes the paragraphs that changed. */
  endEditing(): void {
    Module._TRTextEndEditing(this.nativeHandle);
  }

  /** Runs the edits that a function makes as one batch. */
  edit(body: (text: this) => void): void {
    this.beginEditing();
    try {
      body(this);
    } finally {
      this.endEditing();
    }
  }

  /** Adds a string to the end. */
  append(text: string): void {
    const handle = this.nativeHandle;
    withUtf16(text, (units, length) => {
      if (Module._TRTextAppendCodeUnits(handle, units, length) === 0) {
        throw new Error("Could not append the string.");
      }
    });
  }

  /**
   * Inserts a string at an index, which can be the length to insert at the end.
   *
   * @throws {RangeError} If the index is past the end.
   */
  insert(index: number, text: string): void {
    const handle = this.nativeHandle;
    checkIndex("index", index, Module._TRTextGetLength(handle));
    withUtf16(text, (units, length) => {
      if (Module._TRTextInsertCodeUnits(handle, index, units, length) === 0) {
        throw new Error("Could not insert the string.");
      }
    });
  }

  /**
   * Removes the code units from `fromIndex` up to `toIndex`.
   *
   * @throws {RangeError} If the range is not within the text.
   */
  delete(fromIndex: number, toIndex: number): void {
    const handle = this.nativeHandle;
    checkRange(fromIndex, toIndex, Module._TRTextGetLength(handle));
    Module._TRTextDeleteCodeUnits(handle, fromIndex, toIndex - fromIndex);
  }

  /**
   * Replaces the code units from `fromIndex` up to `toIndex` with a string, which takes the
   * attributes of the range that it replaces.
   *
   * @throws {RangeError} If the range is not within the text.
   */
  replace(fromIndex: number, toIndex: number, text: string): void {
    const handle = this.nativeHandle;
    checkRange(fromIndex, toIndex, Module._TRTextGetLength(handle));
    withUtf16(text, (units, length) => {
      if (Module._TRTextReplaceCodeUnits(handle, fromIndex, toIndex - fromIndex, units, length) === 0) {
        throw new Error("Could not replace the code units.");
      }
    });
  }

  /** Replaces the whole content. The new content takes the attributes of the content it replaces. */
  setString(text: string): void {
    const handle = this.nativeHandle;
    withUtf16(text, (units, length) => {
      if (Module._TRTextSetCodeUnits(handle, units, length) === 0) {
        throw new Error("Could not set the string.");
      }
    });
  }

  /**
   * Sets attributes on the code units from `fromIndex` up to `toIndex`. An attribute that is
   * already set in a part of the range is replaced there. The text keeps what the attributes refer
   * to, such as a typeface, so they can be disposed after the call.
   *
   * @throws {RangeError} If the range is not within the text.
   */
  setAttributes(fromIndex: number, toIndex: number, attributes: TextAttributes): void {
        const handle = this.nativeHandle;
    checkRange(fromIndex, toIndex, Module._TRTextGetLength(handle));

    for (const name of attributeNames(attributes)) {
      withStack((stack) => {
        const attribute = stack.alloc(TRAttribute.size);
        const temporary = writeAttribute(attribute, name, attributes[name]);
        try {
          if (Module._TRTextSetAttribute(handle, fromIndex, toIndex - fromIndex, attribute) === 0) {
            throw new Error(`Could not set the attribute: ${name}`);
          }
        } finally {
          temporary?.dispose();
        }
      });
    }
  }

  /**
   * Removes attributes from the code units from `fromIndex` up to `toIndex`. An attribute that is
   * not set there is left as it is.
   *
   * @throws {RangeError} If the range is not within the text.
   */
  removeAttributes(fromIndex: number, toIndex: number, ...names: TextAttributeName[]): void {
        const handle = this.nativeHandle;
    checkRange(fromIndex, toIndex, Module._TRTextGetLength(handle));
    for (const name of names) {
      Module._TRTextRemoveAttribute(handle, fromIndex, toIndex - fromIndex, attributeType(name));
    }
  }
}

setMutableTextFactory((handle) => new TMutableText(adopt, handle));

