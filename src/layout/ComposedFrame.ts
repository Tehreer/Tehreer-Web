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
import type { Rect } from "../geometry.js";
import { adopt } from "../internal/Adopt.js";
import { callbackPointers, collect } from "../internal/Callbacks.js";
import { NativeObject } from "../internal/NativeObject.js";
import { TRPoint } from "../internal/Structs.js";
import { Module } from "../internal/Module.js";
import { checkRange } from "../internal/Validation.js";
import type { Renderer } from "../graphics/Renderer.js";
import { ComposedLine } from "./ComposedLine.js";

/**
 * Lines of text that are laid out in a frame. A frame is immutable and thread safe. Its
 * coordinates have the origin at its top left, with the y axis pointing downward.
 */
export class ComposedFrame extends NativeObject {
  /** @internal */
  constructor(token: typeof adopt, handle: number) {
    super(handle, (h) => Module._TRComposedFrameRelease(h));
    void token;
  }

  /** @internal */
  static adopting(handle: number): ComposedFrame {
    return new ComposedFrame(adopt, handle);
  }

  /** The index of the first code unit of the frame. */
  get startIndex(): number {
    return Module._TRComposedFrameGetStartIndex(this.nativeHandle);
  }

  /** The index after the last code unit of the frame. */
  get endIndex(): number {
    return Module._TRComposedFrameGetEndIndex(this.nativeHandle);
  }

  get width(): number {
    return Module._TRComposedFrameGetWidth(this.nativeHandle);
  }

  get height(): number {
    return Module._TRComposedFrameGetHeight(this.nativeHandle);
  }

  /** The lines of the frame, from the top. */
  get lines(): List<ComposedLine> {
    return new IndexedList(this, Module._TRComposedFrameGetLineCount(this.nativeHandle), (index) =>
      ComposedLine.retaining(Module._TRComposedFrameGetLine(this.nativeHandle, index)),
    );
  }

  /**
   * Returns the index of the line that has a code unit. The end index of the frame belongs to the
   * last line.
   *
   * @returns The index of the line, or -1 if the code unit has none.
   */
  getLineIndexForCodeUnit(codeUnitIndex: number): number {
    return Module._TRComposedFrameGetLineIndexForCodeUnit(this.nativeHandle, codeUnitIndex);
  }

  /**
   * Returns the index of the line that suits a position best: the line whose top and bottom have
   * its y, or the last line if there is none. Only the y is considered.
   */
  getLineIndexAtPosition(x: number, y: number): number {
    const handle = this.nativeHandle;
    return TRPoint.passing({ x, y }, (position) => Module._TRComposedFrameGetLineIndexAtPosition(handle, position));
  }

  /**
   * Returns the rectangles that cover the code units from `fromIndex` up to `toIndex`. A range
   * that spans lines is covered with the paddings of the lines too: the space after the text of
   * the first line, the whole width of each line in between, and the space before the text of the
   * last line.
   *
   * @throws {RangeError} If the range is not within the frame.
   */
  getSelectionRects(fromIndex: number, toIndex: number): Rect[] {
    const handle = this.nativeHandle;
    checkRange(fromIndex, toIndex, Module._TRComposedFrameGetEndIndex(handle));
    if (fromIndex < Module._TRComposedFrameGetStartIndex(handle)) {
      throw new RangeError(`The range ${fromIndex}..${toIndex} is not within the frame.`);
    }
    return collect<Rect>((context) =>
      Module._TRComposedFrameEnumerateSelection(
        handle, fromIndex, toIndex - fromIndex, callbackPointers().selectionFunc, context),
    );
  }

  /**
   * Draws the lines of the frame into a context, with the top left of the frame at `(x, y)`.
   * Selections and carets are not drawn: fill the rectangles of `getSelectionRects()` before or
   * after.
   */
  draw(renderer: Renderer, context: DrawingContext, x: number, y: number): void {
    const handle = this.nativeHandle;
    renderer.drawInto(context, (rendererHandle) =>
      TRPoint.passing({ x, y }, (origin) => Module._TRComposedFrameDraw(handle, rendererHandle, origin)),
    );
  }

  /**
   * Draws the frame as SVG, where {@link draw} draws it into a context, with the same origin: the
   * glyphs are filled or stroked outlines, backgrounds and decorations are rectangles, and shadows
   * are filters. It returns a `<g>` element for an SVG in pixels, with the y axis pointing down.
   * Replacements are not drawn, and glyphs that have only images (bitmap fonts) are left out.
   */
  toSvg(renderer: Renderer, x: number, y: number): string {
    const handle = this.nativeHandle;
    return renderer.drawSvg((rendererHandle) =>
      TRPoint.passing({ x, y }, (origin) => Module._TRComposedFrameDraw(handle, rendererHandle, origin)),
    );
  }
}
