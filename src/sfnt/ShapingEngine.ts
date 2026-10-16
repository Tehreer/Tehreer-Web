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

import { NativeObject } from "../internal/NativeObject.js";
import { withCString, withUtf16, StringEncodingUTF16 } from "../internal/Memory.js";
import { Module } from "../internal/Module.js";
import { checkCreated, checkRange } from "../internal/Validation.js";
import type { Typeface } from "../graphics/Typeface.js";
import { ShapingOrder, WritingDirection } from "./enums.js";
import { withOpenTypeFeatures } from "./FontFeatures.js";
import type { OpenTypeFeature } from "./OpenTypeFeature.js";
import type { SfntTag } from "./SfntTag.js";
import { ShapingResult } from "./ShapingResult.js";

/**
 * Shapes text into glyphs. It is a configuration object, so it is not thread safe. It is created
 * with no typeface, a type size of 16, the script `DFLT`, the language `dflt`, left to right
 * direction, forward order and no features.
 */
export class ShapingEngine extends NativeObject {
  // Core keeps the typeface and the features too, but handing out what was set is cheaper than
  // reading it back and making new objects each time.
  #typeface: Typeface | undefined;
  #openTypeFeatures: readonly OpenTypeFeature[] = [];

  constructor() {
    super(checkCreated(Module._TRShapingEngineCreate(), "a shaping engine"), (h) =>
      Module._TRShapingEngineRelease(h),
    );
  }

  /** Returns the direction in which text of a script is written by default. */
  static getScriptDefaultDirection(scriptTag: SfntTag): WritingDirection {
    return Module._TRShapingEngineGetScriptDefaultDirection(scriptTag);
  }

  /** Returns the OpenType language tag of a language, given as a BCP 47 tag such as `ur-PK`. */
  static getLanguageTag(languageName: string): SfntTag {
    return withCString(languageName, (name) => Module._TRShapingEngineGetLanguageTagForName(name)) >>> 0;
  }

  get typeface(): Typeface | undefined {
    return this.#typeface;
  }

  set typeface(value: Typeface | undefined) {
    Module._TRShapingEngineSetTypeface(this.nativeHandle, value === undefined ? 0 : value.nativeHandle);
    this.#typeface = value;
  }

  get typeSize(): number {
    return Module._TRShapingEngineGetTypeSize(this.nativeHandle);
  }

  set typeSize(value: number) {
    Module._TRShapingEngineSetTypeSize(this.nativeHandle, value);
  }

  get scriptTag(): SfntTag {
    return Module._TRShapingEngineGetScriptTag(this.nativeHandle) >>> 0;
  }

  set scriptTag(value: SfntTag) {
    Module._TRShapingEngineSetScriptTag(this.nativeHandle, value);
  }

  get languageTag(): SfntTag {
    return Module._TRShapingEngineGetLanguageTag(this.nativeHandle) >>> 0;
  }

  set languageTag(value: SfntTag) {
    Module._TRShapingEngineSetLanguageTag(this.nativeHandle, value);
  }

  get writingDirection(): WritingDirection {
    return Module._TRShapingEngineGetWritingDirection(this.nativeHandle);
  }

  set writingDirection(value: WritingDirection) {
    Module._TRShapingEngineSetWritingDirection(this.nativeHandle, value);
  }

  get shapingOrder(): ShapingOrder {
    return Module._TRShapingEngineGetShapingOrder(this.nativeHandle);
  }

  set shapingOrder(value: ShapingOrder) {
    Module._TRShapingEngineSetShapingOrder(this.nativeHandle, value);
  }

  /** The features to shape with. */
  get openTypeFeatures(): readonly OpenTypeFeature[] {
    return this.#openTypeFeatures;
  }

  set openTypeFeatures(features: readonly OpenTypeFeature[]) {
    const handle = this.nativeHandle;
    withOpenTypeFeatures(features, (pointer, count) => {
      if (Module._TRShapingEngineSetOpenTypeFeatures(handle, pointer, count) === 0) {
        throw new Error("Could not set the OpenType features.");
      }
    });
    this.#openTypeFeatures = [...features];
  }

  /**
   * Shapes the code units of the text from `fromIndex` up to `toIndex`.
   *
   * @throws {Error} If the engine has no typeface, or the shaping fails.
   */
  shapeText(text: string, fromIndex = 0, toIndex: number = text.length): ShapingResult {
    checkRange(fromIndex, toIndex, text.length);
    const handle = this.nativeHandle;
    const created = withUtf16(text.substring(fromIndex, toIndex), (units, length) =>
      Module._TRShapingEngineCreateShapingResult(handle, units, length, StringEncodingUTF16),
    );
    return ShapingResult.adopting(checkCreated(created, "a shaping result"));
  }
}
