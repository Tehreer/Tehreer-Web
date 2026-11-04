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
import { TRAttribute } from "../internal/Structs.js";
import { StringEncodingUTF16, withStack, withUtf16 } from "../internal/Memory.js";
import { Module } from "../internal/Module.js";
import { checkCreated, checkIndex, checkRange } from "../internal/Validation.js";
import { attributeNames, attributeType, withDefaultAttributes, writeAttribute } from "./TextAttributeCodec.js";
import type { TextAttributeName, TextAttributes } from "./TextAttributes.js";
import { setMutableTypesetterFactory, Typesetter } from "./Typesetter.js";

/**
 * A typesetter that can be edited. A range that an edit puts in takes the attributes of what it
 * replaces. An edit whose replacement throws while shaping stays applied, and the error is
 * rethrown afterwards. Its paragraphs are shaped as they are edited, or once when a batch of
 * edits ends.
 *
 * A mutable typesetter is not thread safe. Take a copy with `copy()` to lay it out while it is
 * edited. No line can be made, no break suggested and no copy taken while it is in a batch.
 */
export class MutableTypesetter extends Typesetter {
  /**
   * Makes a mutable typesetter of an empty text.
   *
   * @param defaultAttributes The attributes to use where the text sets none, as for `Typesetter`.
   */
  constructor(defaultAttributes?: TextAttributes);
  /** @internal */
  constructor(token: typeof adopt, handle: number);
  constructor(defaultAttributes?: TextAttributes | typeof adopt, handle?: number) {
    if (defaultAttributes === adopt) {
      super(adopt, handle as number);
    } else {
      super(
        adopt,
        checkCreated(
          withDefaultAttributes(defaultAttributes ?? {}, (memory, count) =>
            Module._TRTypesetterCreateMutable(StringEncodingUTF16, memory, count),
          ),
          "a mutable typesetter",
        ),
      );
    }
  }

  /**
   * Starts a batch of edits, whose analysis and shaping are deferred until `endEditing()`. The
   * attributes can be set and removed in a batch, so a text with many attributes is built in one,
   * not by one change after another, each of which shapes its paragraph again. Batches do not nest: a second `beginEditing()` has no effect.
   */
  beginEditing(): void {
    Module._TRTypesetterBeginEditing(this.nativeHandle);
  }

  /** Ends a batch of edits, and analyzes the paragraphs that changed. */
  endEditing(): void {
    callingBack(() => Module._TRTypesetterEndEditing(this.nativeHandle));
  }

  /** Runs the edits that a function makes as one batch. */
  edit(body: (typesetter: this) => void): void {
    this.beginEditing();
    let failure: unknown;
    let failed = false;
    try {
      body(this);
    } catch (error) {
      failed = true;
      failure = error;
    }
    try {
      this.endEditing();
    } catch (error) {
      // The error of the body is the first cause, so it wins over one from shaping.
      if (!failed) {
        throw error;
      }
    }
    if (failed) {
      throw failure;
    }
  }

  /** Adds a string to the end. */
  append(text: string): void {
    const handle = this.nativeHandle;
    withUtf16(text, (units, length) => {
      if (callingBack(() => Module._TRTypesetterAppendCodeUnits(handle, units, length)) === 0) {
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
    checkIndex("index", index, Module._TRTypesetterGetLength(handle));
    withUtf16(text, (units, length) => {
      if (callingBack(() => Module._TRTypesetterInsertCodeUnits(handle, index, units, length)) === 0) {
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
    checkRange(fromIndex, toIndex, Module._TRTypesetterGetLength(handle));
    callingBack(() => Module._TRTypesetterDeleteCodeUnits(handle, fromIndex, toIndex - fromIndex));
  }

  /**
   * Replaces the code units from `fromIndex` up to `toIndex` with a string, which takes the
   * attributes of the range that it replaces.
   *
   * @throws {RangeError} If the range is not within the text.
   */
  replace(fromIndex: number, toIndex: number, text: string): void {
    const handle = this.nativeHandle;
    checkRange(fromIndex, toIndex, Module._TRTypesetterGetLength(handle));
    withUtf16(text, (units, length) => {
      if (callingBack(() => Module._TRTypesetterReplaceCodeUnits(handle, fromIndex, toIndex - fromIndex, units, length)) === 0) {
        throw new Error("Could not replace the code units.");
      }
    });
  }

  /** Replaces the whole content. The new content takes the attributes of the content it replaces. */
  setString(text: string): void {
    const handle = this.nativeHandle;
    withUtf16(text, (units, length) => {
      if (callingBack(() => Module._TRTypesetterSetCodeUnits(handle, units, length)) === 0) {
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
    checkRange(fromIndex, toIndex, Module._TRTypesetterGetLength(handle));

    for (const name of attributeNames(attributes)) {
      withStack((stack) => {
        const attribute = stack.alloc(TRAttribute.size);
        const temporary = writeAttribute(attribute, name, attributes[name]);
        try {
          if (callingBack(() => Module._TRTypesetterSetAttribute(handle, fromIndex, toIndex - fromIndex, attribute)) === 0) {
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
    checkRange(fromIndex, toIndex, Module._TRTypesetterGetLength(handle));
    for (const name of names) {
      callingBack(() => Module._TRTypesetterRemoveAttribute(handle, fromIndex, toIndex - fromIndex, attributeType(name)));
    }
  }
}

setMutableTypesetterFactory((handle) => new MutableTypesetter(adopt, handle));

