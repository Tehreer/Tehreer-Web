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

import type { Rect } from "../geometry.js";
import { callbackPointers, collect } from "../internal/Callbacks.js";
import { NativeObject } from "../internal/NativeObject.js";
import { withStack } from "../internal/Memory.js";
import { TRRect } from "../internal/Structs.js";
import { Module } from "../internal/Module.js";
import { checkCreated, checkElement } from "../internal/Validation.js";
import type { Renderer } from "../graphics/Renderer.js";
import type { ComposedFrame } from "./ComposedFrame.js";

/**
 * Finds the lines of a frame that are in an area, by the boxes that cover their ink. It is made
 * once for a frame, and measures the lines with the renderer as it is at that time.
 */
export class LineLocator extends NativeObject {
  readonly #frame: ComposedFrame;
  readonly #renderer: Renderer;

  constructor(frame: ComposedFrame, renderer: Renderer) {
    super(
      checkCreated(Module._TRLineLocatorCreate(frame.nativeHandle, renderer.nativeHandle), "a line locator"),
      (h) => Module._TRLineLocatorRelease(h),
    );
    // The locator does not retain the frame it was made for, so it is kept alive here. The same is
    // done for the renderer, whose settings it has measured the lines with.
    this.#frame = frame;
    this.#renderer = renderer;
  }

  get lineCount(): number {
    return Module._TRLineLocatorGetLineCount(this.nativeHandle);
  }

  /**
   * Returns the box that covers the ink of a line, in the coordinates of the frame.
   *
   * @throws {RangeError} If the index is not of a line.
   */
  getLineBox(lineIndex: number): Rect {
    const handle = this.nativeHandle;
    checkElement("lineIndex", lineIndex, Module._TRLineLocatorGetLineCount(handle));
    return withStack((stack) => {
      const box = TRRect.allocate(stack);
      Module._TRLineLocatorGetLineBox(handle, lineIndex, box);
      return TRRect.snapshot(box);
    });
  }

  /** Returns the indices of the lines whose boxes meet a rectangle, from the first. */
  findLines(bounds: Rect): number[] {
    const handle = this.nativeHandle;
    return TRRect.passing(bounds, (rect) =>
      collect<number>((context) =>
        Module._TRLineLocatorEnumerateLines(handle, rect, callbackPointers().lineLocatorFunc, context),
      ),
    );
  }

  /** Returns the index of the first line whose box has something below a y. */
  getFirstLineIndexBelow(y: number): number {
    return Module._TRLineLocatorGetFirstLineIndexBelow(this.nativeHandle, y);
  }
}
