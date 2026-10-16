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

import type { Float, UInt16, UInt32 } from "../collections/NumberKind.js";
import { coreNumbers, corePoints } from "../collections/CoreList.js";
import type { NumberList, PointList } from "../collections/List.js";
import type { Color } from "../Color.js";
import type { DrawingContext } from "../drawing/DrawingContext.js";
import type { Point, Rect } from "../geometry.js";
import { adopt } from "../internal/Adopt.js";
import { NativeObject } from "../internal/NativeObject.js";
import { withStack } from "../internal/Memory.js";
import { f32, ptr, u16, u32 } from "../internal/Struct.js";
import { TRPoint, TRRect } from "../internal/Structs.js";
import { Module } from "../internal/Module.js";
import { Renderer } from "../graphics/Renderer.js";
import { Typeface } from "../graphics/Typeface.js";
import { WritingDirection } from "../sfnt/enums.js";
import { Replacement } from "./Replacement.js";

/**
 * A run of glyphs that share their typeface, size, direction and other attributes. A line is made
 * of runs, which are in the visual order of the line.
 *
 * Positions are relative to the start of the line, and indices are those of the text. The lists
 * read the memory of Core when they are read, so they are valid while the run is not disposed.
 */
export class GlyphRun extends NativeObject {
  /** @internal */
  constructor(token: typeof adopt, handle: number) {
    super(handle, (h) => Module._TRGlyphRunRelease(h));
    void token;
  }

  /** Makes a wrapper for a run that its line does not retain for the caller. @internal */
  static retaining(handle: number): GlyphRun {
    return new GlyphRun(adopt, Module._TRGlyphRunRetain(handle));
  }

  /** The index of the first code unit of the run. */
  get startIndex(): number {
    return Module._TRGlyphRunGetStartIndex(this.nativeHandle);
  }

  /** The index after the last code unit of the run. */
  get endIndex(): number {
    return Module._TRGlyphRunGetEndIndex(this.nativeHandle);
  }

  /** The number of code units before the start of the run that its first cluster takes too. */
  get startExtraLength(): number {
    return Module._TRGlyphRunGetStartExtraLength(this.nativeHandle);
  }

  /** The number of code units after the end of the run that its last cluster takes too. */
  get endExtraLength(): number {
    return Module._TRGlyphRunGetEndExtraLength(this.nativeHandle);
  }

  get bidiLevel(): number {
    return Module._TRGlyphRunGetBidiLevel(this.nativeHandle);
  }

  get writingDirection(): WritingDirection {
    return Module._TRGlyphRunGetWritingDirection(this.nativeHandle);
  }

  /** Tells whether the glyphs are in the reverse order of the code units. */
  get isBackward(): boolean {
    return Module._TRGlyphRunIsBackward(this.nativeHandle) !== 0;
  }

  /** The typeface of the glyphs, which is undefined for a replacement. */
  get typeface(): Typeface | undefined {
    const handle = Module._TRGlyphRunGetTypeface(this.nativeHandle);
    return handle === 0 ? undefined : Typeface.retaining(handle);
  }

  get typeSize(): number {
    return Module._TRGlyphRunGetTypeSize(this.nativeHandle);
  }

  get scaleX(): number {
    return Module._TRGlyphRunGetScaleX(this.nativeHandle);
  }

  get scaleY(): number {
    return Module._TRGlyphRunGetScaleY(this.nativeHandle);
  }

  /** What replaces the text of the run, if anything does. */
  get replacement(): Replacement | undefined {
    const handle = Module._TRGlyphRunGetReplacement(this.nativeHandle);
    return handle === 0 ? undefined : Replacement.retaining(handle);
  }

  /** The foreground color that the text sets, or `undefined` if it sets none. */
  get foregroundColor(): Color | undefined {
    return this.#color(Module._TRGlyphRunGetForegroundColor);
  }

  get backgroundColor(): Color | undefined {
    return this.#color(Module._TRGlyphRunGetBackgroundColor);
  }

  get decorationColor(): Color | undefined {
    return this.#color(Module._TRGlyphRunGetDecorationColor);
  }

  get hasUnderline(): boolean {
    return Module._TRGlyphRunHasUnderline(this.nativeHandle) !== 0;
  }

  get hasStrikethrough(): boolean {
    return Module._TRGlyphRunHasStrikethrough(this.nativeHandle) !== 0;
  }

  /** The integer that the text sets as its user data, or 0 if it sets none. */
  get userData(): number {
    return Module._TRGlyphRunGetUserData(this.nativeHandle);
  }

  get ascent(): number {
    return Module._TRGlyphRunGetAscent(this.nativeHandle);
  }

  get descent(): number {
    return Module._TRGlyphRunGetDescent(this.nativeHandle);
  }

  get leading(): number {
    return Module._TRGlyphRunGetLeading(this.nativeHandle);
  }

  /** The position of the start of the run on its baseline, relative to the line. */
  get origin(): Point {
    const handle = this.nativeHandle;
    return TRPoint.returning((ret) => Module._TRGlyphRunGetOrigin(ret, handle));
  }

  get width(): number {
    return Module._TRGlyphRunGetWidth(this.nativeHandle);
  }

  get height(): number {
    return Module._TRGlyphRunGetHeight(this.nativeHandle);
  }

  get glyphCount(): number {
    return Module._TRGlyphRunGetGlyphCount(this.nativeHandle);
  }

  /** The ID of each glyph, in the order of the writing direction. */
  get glyphIds(): NumberList<UInt16> {
    const handle = this.nativeHandle;
    return coreNumbers(this, Module._TRGlyphRunGetGlyphIDsPtr(handle), this.glyphCount, u16);
  }

  /** The offset of each glyph from its pen position, with the y axis pointing up. */
  get glyphOffsets(): PointList {
    const handle = this.nativeHandle;
    return corePoints(this, Module._TRGlyphRunGetGlyphOffsetsPtr(handle), this.glyphCount);
  }

  get glyphAdvances(): NumberList<Float> {
    const handle = this.nativeHandle;
    return coreNumbers(this, Module._TRGlyphRunGetGlyphAdvancesPtr(handle), this.glyphCount, f32);
  }

  /** The index of the glyph of each code unit of the run, from its start. */
  get clusterMap(): NumberList<UInt32> {
    const handle = this.nativeHandle;
    return coreNumbers(
      this,
      Module._TRGlyphRunGetClusterMapPtr(handle),
      Module._TRGlyphRunGetClusterMapCount(handle),
      ptr,
    );
  }

  /** Returns the index of the first code unit of the cluster that has a code unit, or -1. */
  getClusterStart(codeUnitIndex: number): number {
    return Module._TRGlyphRunGetClusterStart(this.nativeHandle, codeUnitIndex);
  }

  /** Returns the index after the last code unit of the cluster that has a code unit, or -1. */
  getClusterEnd(codeUnitIndex: number): number {
    return Module._TRGlyphRunGetClusterEnd(this.nativeHandle, codeUnitIndex);
  }

  /**
   * Returns the distance from the start of the run to the boundary before a code unit, which
   * can be the end of the run too. The start of the run is its left edge.
   *
   * @throws {RangeError} If the code unit is not in the run.
   */
  getCodeUnitDistance(codeUnitIndex: number): number {
    const handle = this.nativeHandle;
    return withStack((stack) => {
      const distance = stack.alloc(4);
      if (Module._TRGlyphRunGetCodeUnitDistance(handle, codeUnitIndex, distance) === 0) {
        throw new RangeError(`The code unit ${codeUnitIndex} is not in the run.`);
      }
      return f32.read(distance);
    });
  }

  /** Returns the code unit boundary that is closest to a distance from the start of the run. */
  getCodeUnitIndexAtDistance(distance: number): number {
    return Module._TRGlyphRunGetCodeUnitIndexAtDistance(this.nativeHandle, distance);
  }

  /**
   * Computes the box that the ink of the run covers, relative to the start of the run on its
   * baseline.
   */
  computeInkBox(renderer: Renderer): Rect {
    const handle = this.nativeHandle;
    const rendererHandle = renderer.nativeHandle;
    return TRRect.returning((ret) => Module._TRGlyphRunComputeInkBox(ret, handle, rendererHandle));
  }

  /**
   * Draws the background, the glyphs and the decorations of the run into a context, with the
   * start of the run on its baseline at `(x, y)`.
   */
  draw(renderer: Renderer, context: DrawingContext, x: number, y: number): void {
    const handle = this.nativeHandle;
    renderer.drawInto(context, (rendererHandle) =>
      TRPoint.passing({ x, y }, (origin) => Module._TRGlyphRunDraw(handle, rendererHandle, origin)),
    );
  }

  #color(getter: (run: number, color: number) => number): Color | undefined {
    const handle = this.nativeHandle;
    return withStack((stack) => {
      const out = stack.alloc(4);
      return getter(handle, out) === 0 ? undefined : u32.read(out);
    });
  }
}
