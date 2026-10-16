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
