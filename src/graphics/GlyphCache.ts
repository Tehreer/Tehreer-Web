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
import { Module } from "../internal/Module.js";
import { checkCreated } from "../internal/Validation.js";

/**
 * A cache of the images of glyphs, which a renderer fills. Renderers that share a cache share its
 * images too. The cache is thread safe in Core, but a renderer is not.
 */
export class GlyphCache extends NativeObject {
  /** Makes a cache that holds up to `capacity` bytes of glyph images. */
  constructor(capacity: number);
  /** @internal */
  constructor(token: typeof adopt, handle: number);
  constructor(capacity: number | typeof adopt, handle?: number) {
    super(
      capacity === adopt
        ? (handle as number)
        : checkCreated(Module._TRGlyphCacheCreate(capacity), "a glyph cache"),
      (h) => Module._TRGlyphCacheRelease(h),
    );
  }

  /** The cache that renderers use unless they are given another one. */
  static get default(): GlyphCache {
        return new GlyphCache(adopt, Module._TRGlyphCacheRetain(Module._TRGlyphCacheGetDefault()));
  }

  /** The number of bytes of glyph images that the cache holds up to. */
  get capacity(): number {
    return Module._TRGlyphCacheGetCapacity(this.nativeHandle);
  }

  set capacity(value: number) {
    Module._TRGlyphCacheSetCapacity(this.nativeHandle, value);
  }

  /** The number of bytes of glyph images that the cache holds now. */
  get size(): number {
    return Module._TRGlyphCacheGetSize(this.nativeHandle);
  }

  /** Removes all images. */
  clear(): void {
    Module._TRGlyphCacheClear(this.nativeHandle);
  }
}
