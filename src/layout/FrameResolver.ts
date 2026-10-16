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

import type { Size } from "../geometry.js";
import { callingBack } from "../internal/Callbacks.js";
import { NativeObject } from "../internal/NativeObject.js";
import { TRSize } from "../internal/Structs.js";
import { Module } from "../internal/Module.js";
import { checkCreated, checkOrderedRange } from "../internal/Validation.js";
import { ComposedFrame } from "./ComposedFrame.js";
import { BreakMode, TextAlignment, TruncationPlace, VerticalAlignment } from "./enums.js";
import { Typesetter } from "./Typesetter.js";

/**
 * Lays the lines of a typesetter out in a frame. It is a configuration object, so it is not
 * thread safe.
 *
 * It is created with no typesetter, an unbounded frame that does not fit its lines, leading text
 * alignment, top vertical alignment, no truncation (with the line break mode and the end as its
 * defaults), no justification (with the level 1), no limit of lines, no extra line spacing, and a
 * line height multiplier of 1.
 */
export class FrameResolver extends NativeObject {
  constructor() {
    super(checkCreated(Module._TRFrameResolverCreate(), "a frame resolver"), (h) =>
      Module._TRFrameResolverRelease(h),
    );
  }

  /** The typesetter to make frames with. The resolver keeps a reference of its own. */
  get typesetter(): Typesetter | undefined {
    const handle = Module._TRFrameResolverGetTypesetter(this.nativeHandle);
    return handle === 0 ? undefined : Typesetter.retaining(handle);
  }

  set typesetter(value: Typesetter | undefined) {
    Module._TRFrameResolverSetTypesetter(this.nativeHandle, value === undefined ? 0 : value.nativeHandle);
  }

  /**
   * The width of the frame, as it was set. It is unbounded by default. A negative or NaN width is
   * taken as zero when making a frame.
   */
  get frameWidth(): number {
    return this.#getFrameSize().width;
  }

  set frameWidth(width: number) {
    this.#setFrameSize(width, this.#getFrameSize().height);
  }

  /**
   * The height of the frame, as it was set. It is unbounded by default. A negative or NaN height
   * is taken as zero when making a frame.
   */
  get frameHeight(): number {
    return this.#getFrameSize().height;
  }

  set frameHeight(height: number) {
    this.#setFrameSize(this.#getFrameSize().width, height);
  }

  /** Tells whether the frame is as wide as its widest line, instead of the width that is set. */
  get fitsHorizontally(): boolean {
    return Module._TRFrameResolverGetFitsHorizontally(this.nativeHandle) !== 0;
  }

  set fitsHorizontally(value: boolean) {
    Module._TRFrameResolverSetFitsHorizontally(this.nativeHandle, value ? 1 : 0);
  }

  /** Tells whether the frame is as tall as its lines, instead of the height that is set. */
  get fitsVertically(): boolean {
    return Module._TRFrameResolverGetFitsVertically(this.nativeHandle) !== 0;
  }

  set fitsVertically(value: boolean) {
    Module._TRFrameResolverSetFitsVertically(this.nativeHandle, value ? 1 : 0);
  }

  /** The alignment of the lines of the paragraphs that do not have their own. */
  get textAlignment(): TextAlignment {
    return Module._TRFrameResolverGetTextAlignment(this.nativeHandle);
  }

  set textAlignment(value: TextAlignment) {
    Module._TRFrameResolverSetTextAlignment(this.nativeHandle, value);
  }

  /** Where the lines are placed if the frame is taller than they are. */
  get verticalAlignment(): VerticalAlignment {
    return Module._TRFrameResolverGetVerticalAlignment(this.nativeHandle);
  }

  set verticalAlignment(value: VerticalAlignment) {
    Module._TRFrameResolverSetVerticalAlignment(this.nativeHandle, value);
  }

  /** How the text that does not fit is found. It does not enable the truncation. */
  get truncationMode(): BreakMode {
    return Module._TRFrameResolverGetTruncationMode(this.nativeHandle);
  }

  set truncationMode(value: BreakMode) {
    Module._TRFrameResolverSetTruncationMode(this.nativeHandle, value);
  }

  /** Where the text is cut out. It does not enable the truncation. */
  get truncationPlace(): TruncationPlace {
    return Module._TRFrameResolverGetTruncationPlace(this.nativeHandle);
  }

  set truncationPlace(value: TruncationPlace) {
    Module._TRFrameResolverSetTruncationPlace(this.nativeHandle, value);
  }

  /** Tells whether the last line of a frame that has no more room is truncated. */
  get isTruncationEnabled(): boolean {
    return Module._TRFrameResolverIsTruncationEnabled(this.nativeHandle) !== 0;
  }

  set isTruncationEnabled(value: boolean) {
    Module._TRFrameResolverSetTruncationEnabled(this.nativeHandle, value ? 1 : 0);
  }

  get isJustificationEnabled(): boolean {
    return Module._TRFrameResolverIsJustificationEnabled(this.nativeHandle) !== 0;
  }

  set isJustificationEnabled(value: boolean) {
    Module._TRFrameResolverSetJustificationEnabled(this.nativeHandle, value ? 1 : 0);
  }

  /** How much of the extra space of a line is used to justify it. A higher level spreads it further. */
  get justificationLevel(): number {
    return Module._TRFrameResolverGetJustificationLevel(this.nativeHandle);
  }

  set justificationLevel(value: number) {
    Module._TRFrameResolverSetJustificationLevel(this.nativeHandle, value);
  }

  /** The greatest number of lines in a frame, or `undefined` for no limit. */
  get maxLines(): number | undefined {
    const count = Module._TRFrameResolverGetMaxLines(this.nativeHandle);
    return count === 0 ? undefined : count;
  }

  set maxLines(value: number | undefined) {
    Module._TRFrameResolverSetMaxLines(this.nativeHandle, value ?? 0);
  }

  get extraLineSpacing(): number {
    return Module._TRFrameResolverGetExtraLineSpacing(this.nativeHandle);
  }

  set extraLineSpacing(value: number) {
    Module._TRFrameResolverSetExtraLineSpacing(this.nativeHandle, value);
  }

  get lineHeightMultiplier(): number {
    return Module._TRFrameResolverGetLineHeightMultiplier(this.nativeHandle);
  }

  set lineHeightMultiplier(value: number) {
    Module._TRFrameResolverSetLineHeightMultiplier(this.nativeHandle, value);
  }

  /**
   * Makes a frame of the code units from `fromIndex` up to `toIndex`.
   *
   * @throws {Error} If there is no typesetter.
   * @throws {RangeError} If the range is empty or is not within the text.
   */
  createFrame(fromIndex: number, toIndex: number): ComposedFrame {
    const handle = this.nativeHandle;
    if (Module._TRFrameResolverGetTypesetter(handle) === 0) {
      throw new Error("The typesetter is not set.");
    }
    checkOrderedRange(fromIndex, toIndex);
    const frame = callingBack(() =>
      Module._TRFrameResolverCreateFrame(handle, fromIndex, toIndex - fromIndex),
    );
    if (frame === 0) {
      throw new RangeError("The range is empty or is not within the text.");
    }
    return ComposedFrame.adopting(frame);
  }

  #getFrameSize(): Size {
    const handle = this.nativeHandle;
    return TRSize.returning((ret) => Module._TRFrameResolverGetFrameSize(ret, handle));
  }

  #setFrameSize(width: number, height: number): void {
    const handle = this.nativeHandle;
    TRSize.passing({ width, height }, (copy) => Module._TRFrameResolverSetFrameSize(handle, copy));
  }
}
