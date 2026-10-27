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

import { IndexedList } from "../collections/CoreList.js";
import type { List } from "../collections/List.js";
import type { DrawingContext } from "../drawing/DrawingContext.js";
import type { Point, Rect } from "../geometry.js";
import { adopt } from "../internal/Adopt.js";
import { callbackPointers, collect } from "../internal/Callbacks.js";
import { NativeObject } from "../internal/NativeObject.js";
import { withStack } from "../internal/Memory.js";
import { f32 } from "../internal/Struct.js";
import { TRPoint, TRRect } from "../internal/Structs.js";
import { Module } from "../internal/Module.js";
import { checkRange } from "../internal/Validation.js";
import type { Renderer } from "../graphics/Renderer.js";
import { GlyphRun } from "./GlyphRun.js";

/** The left and the right edge of a part of a line, measured from its start. */
export interface VisualEdge {
  readonly left: number;
  readonly right: number;
}

/**
 * A line of text that is laid out. It is made of glyph runs, which are in its visual order. A line
 * is immutable and thread safe.
 */
export class ComposedLine extends NativeObject {
  /** @internal */
  constructor(token: typeof adopt, handle: number) {
    super(handle, (h) => Module._TRComposedLineRelease(h));
    void token;
  }

  /** @internal */
  static adopting(handle: number): ComposedLine {
    return new ComposedLine(adopt, handle);
  }

  /** Makes a wrapper for a line that its frame does not retain for the caller. @internal */
  static retaining(handle: number): ComposedLine {
    return new ComposedLine(adopt, Module._TRComposedLineRetain(handle));
  }

  /** The index of the first code unit of the line. */
  get startIndex(): number {
    return Module._TRComposedLineGetStartIndex(this.nativeHandle);
  }

  /** The index after the last code unit of the line. */
  get endIndex(): number {
    return Module._TRComposedLineGetEndIndex(this.nativeHandle);
  }

  /** The base level of the paragraph: even for left-to-right and odd for right-to-left. */
  get paragraphLevel(): number {
    return Module._TRComposedLineGetParagraphLevel(this.nativeHandle);
  }

  /** The position of the start of the line on its baseline, relative to its frame. */
  get origin(): Point {
    const handle = this.nativeHandle;
    return TRPoint.returning((ret) => Module._TRComposedLineGetOrigin(ret, handle));
  }

  /** The distance from the baseline to the top of the line. */
  get ascent(): number {
    return Module._TRComposedLineGetAscent(this.nativeHandle);
  }

  /** The distance from the baseline to the bottom of the line. */
  get descent(): number {
    return Module._TRComposedLineGetDescent(this.nativeHandle);
  }

  /** The extra space below the descent of the line. */
  get leading(): number {
    return Module._TRComposedLineGetLeading(this.nativeHandle);
  }

  get width(): number {
    return Module._TRComposedLineGetWidth(this.nativeHandle);
  }

  get height(): number {
    return Module._TRComposedLineGetHeight(this.nativeHandle);
  }

  /** The extent of the whitespace at the end of the line. */
  get trailingWhitespaceExtent(): number {
    return Module._TRComposedLineGetTrailingWhitespaceExtent(this.nativeHandle);
  }

  /** Tells whether the line is of a block replacement, which has a line of its own. */
  get isBlock(): boolean {
    return Module._TRComposedLineIsBlock(this.nativeHandle) !== 0;
  }

  get isTruncated(): boolean {
    return Module._TRComposedLineIsTruncated(this.nativeHandle) !== 0;
  }

  /** The runs of the line, in its visual order. */
  get runs(): List<GlyphRun> {
    return new IndexedList(this, Module._TRComposedLineGetGlyphRunCount(this.nativeHandle), (index) =>
      GlyphRun.retaining(Module._TRComposedLineGetGlyphRun(this.nativeHandle, index)),
    );
  }

  /**
   * Returns the distance from the start of the line to the boundary before a code unit, which can
   * be the end of the line too. The start of the line is its left edge, so the distance is
   * measured along the screen, also in a right-to-left run.
   *
   * @throws {RangeError} If the code unit is not in the line.
   */
  getCodeUnitDistance(codeUnitIndex: number): number {
    const handle = this.nativeHandle;
    return withStack((stack) => {
      const distance = stack.alloc(4);
      if (Module._TRComposedLineGetCodeUnitDistance(handle, codeUnitIndex, distance) === 0) {
        throw new RangeError(`The code unit ${codeUnitIndex} is not in the line.`);
      }
      return f32.read(distance);
    });
  }

  /**
   * Returns the parts of the line that the code units from `fromIndex` up to `toIndex` cover, as
   * their left and right visual edges: a part for each run that the range touches.
   *
   * @throws {RangeError} If the range is not within the line.
   */
  getVisualEdges(fromIndex: number, toIndex: number): VisualEdge[] {
    const handle = this.nativeHandle;
    checkRange(fromIndex, toIndex, Module._TRComposedLineGetEndIndex(handle));
    if (fromIndex < Module._TRComposedLineGetStartIndex(handle)) {
      throw new RangeError(`The range ${fromIndex}..${toIndex} is not within the line.`);
    }
    return collect<VisualEdge>((context) =>
      Module._TRComposedLineEnumerateVisualEdges(
        handle, fromIndex, toIndex - fromIndex, callbackPointers().edgeFunc, context),
    );
  }

  /** Returns the code unit boundary that is closest to a distance from the start of the line. */
  getCodeUnitIndexAtDistance(distance: number): number {
    return Module._TRComposedLineGetCodeUnitIndexAtDistance(this.nativeHandle, distance);
  }

  /**
   * Returns how far to move the start of the line so that it is aligned. The extent that the line
   * does not take, without its trailing whitespace, is multiplied by the flush factor.
   *
   * @param flushFactor 0 to align to the left of the extent, 1 to the right, and 0.5 to center.
   * @param flushExtent The width of the space in which the line is aligned.
   */
  getPenOffset(flushFactor: number, flushExtent: number): number {
    return Module._TRComposedLineGetPenOffset(this.nativeHandle, flushFactor, flushExtent);
  }

  /**
   * Computes the box that the ink of the line covers, relative to its origin. It is an empty
   * rectangle at the origin if no run has ink.
   */
  computeInkBox(renderer: Renderer): Rect {
    const handle = this.nativeHandle;
    const rendererHandle = renderer.nativeHandle;
    return TRRect.returning((ret) => Module._TRComposedLineComputeInkBox(ret, handle, rendererHandle));
  }

  /**
   * Draws the runs of the line into a context, in their visual order.
   *
   * @param x The x of the origin of the container of the line. The origin of the line is added.
   * @param y The y of the origin of the container.
   */
  draw(renderer: Renderer, context: DrawingContext, x: number, y: number): void {
    const handle = this.nativeHandle;
    renderer.drawInto(context, (rendererHandle) =>
      TRPoint.passing({ x, y }, (origin) => Module._TRComposedLineDraw(handle, rendererHandle, origin)),
    );
  }

  /**
   * Draws the line as SVG, where {@link draw} draws it into a context, with the same origin: the
   * glyphs are filled or stroked outlines, backgrounds and decorations are rectangles, and shadows
   * are filters. It returns a `<g>` element for an SVG in pixels, with the y axis pointing down.
   * Replacements are not drawn, and glyphs that have only images (bitmap fonts) are left out.
   */
  toSvg(renderer: Renderer, x: number, y: number): string {
    const handle = this.nativeHandle;
    return renderer.drawSvg((rendererHandle) =>
      TRPoint.passing({ x, y }, (origin) => Module._TRComposedLineDraw(handle, rendererHandle, origin)),
    );
  }
}
