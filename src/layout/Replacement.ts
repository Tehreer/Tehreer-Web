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

import type { ReplacementDelegate, ReplacementRoom } from "../drawing/ReplacementDelegate.js";
import { adopt } from "../internal/Adopt.js";
import { callbackPointers, callingBack, replacementKeys, replacements } from "../internal/Callbacks.js";
import { NativeObject } from "../internal/NativeObject.js";
import { TRReplacementRoom } from "../internal/Structs.js";
import { Module } from "../internal/Module.js";
import { ReplacementKind } from "./enums.js";

/**
 * Content that replaces a range of text, such as an image or a view. Core only uses its room to
 * lay out the line, and the delegate draws it.
 */
export class Replacement extends NativeObject {
  /**
   * @param delegate Gives the size of the replacement, and draws it.
   * @param kind How the replacement is placed in the text.
   */
  constructor(delegate: ReplacementDelegate, kind?: ReplacementKind);
  /** @internal */
  constructor(token: typeof adopt, handle: number);
  constructor(source: ReplacementDelegate | typeof adopt, kindOrHandle: ReplacementKind | number = ReplacementKind.Inline) {
    super(
      source === adopt ? kindOrHandle : Replacement.#create(source, kindOrHandle),
      (h) => Module._TRReplacementRelease(h),
    );
  }

  static #create(delegate: ReplacementDelegate, kind: ReplacementKind): number {
    const state = {
      computeRoom: (layoutWidth: number) => delegate.computeRoom(layoutWidth),
      handle: 0,
      delegate,
    };
    const key = replacements.add(state);
    const handle = Module._TRReplacementCreate(callbackPointers().replacementCallbacks, key, kind);
    if (handle === 0) {
      replacements.remove(key);
      throw new Error("Could not create a replacement.");
    }
    state.handle = handle;
    replacementKeys.set(handle, key);
    return handle;
  }

  /** Makes a wrapper for a replacement that Core does not retain for the caller. @internal */
  static retaining(handle: number): Replacement {
    return new Replacement(adopt, Module._TRReplacementRetain(handle));
  }

  get kind(): ReplacementKind {
    return Module._TRReplacementGetKind(this.nativeHandle);
  }

  /** The delegate that the replacement was made with. */
  get delegate(): ReplacementDelegate | undefined {
    const key = replacementKeys.get(this.nativeHandle);
    return key === undefined ? undefined : (replacements.get(key)?.delegate as ReplacementDelegate | undefined);
  }

  /** Computes the room of the replacement for a layout width, which asks the delegate. */
  computeRoom(layoutWidth: number): ReplacementRoom {
    const handle = this.nativeHandle;
    return TRReplacementRoom.returning((room) =>
      callingBack(() => Module._TRReplacementComputeRoom(handle, layoutWidth, room)),
    );
  }
}
