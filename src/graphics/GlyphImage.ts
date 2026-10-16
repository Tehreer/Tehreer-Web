import { Color } from "../Color.js";
import { adopt } from "../internal/Adopt.js";
import { NativeObject } from "../internal/NativeObject.js";
import { copyBytes } from "../internal/Memory.js";
import { Module } from "../internal/Module.js";
import { GlyphImageFormat } from "./enums.js";

/**
 * The image of a glyph, which a renderer made at its size, scale and skew. Images are shared
 * with the glyph cache, so they are read only.
 */
export class GlyphImage extends NativeObject {
  /** @internal */
  constructor(token: typeof adopt, handle: number) {
    super(handle, (h) => Module._TRGlyphImageRelease(h));
    void token;
  }

  /** @internal */
  static adopting(handle: number): GlyphImage {
    return new GlyphImage(adopt, handle);
  }

  /** @internal */
  static retaining(handle: number): GlyphImage {
    return new GlyphImage(adopt, Module._TRGlyphImageRetain(handle));
  }

  get format(): GlyphImageFormat {
    return Module._TRGlyphImageGetFormat(this.nativeHandle);
  }

  /** The distance from the pen position to the left edge of the image, in pixels. */
  get left(): number {
    return Module._TRGlyphImageGetLeft(this.nativeHandle);
  }

  /** The distance from the baseline up to the top edge of the image, in pixels. */
  get top(): number {
    return Module._TRGlyphImageGetTop(this.nativeHandle);
  }

  get width(): number {
    return Module._TRGlyphImageGetWidth(this.nativeHandle);
  }

  get height(): number {
    return Module._TRGlyphImageGetHeight(this.nativeHandle);
  }

  /** A copy of the pixels, in the layout that `format` tells. */
  get pixels(): Uint8Array {
        const handle = this.nativeHandle;
    return copyBytes(Module._TRGlyphImageGetPixelsPtr(handle), Module._TRGlyphImageGetByteCount(handle));
  }

  /**
   * Makes the pixels as straight (not premultiplied) RGBA bytes, which `ImageData` takes.
   *
   * @param color The color to paint an `Alpha` image with. A color image keeps its own colors.
   */
  toRgba(color: Color = 0xff000000): Uint8ClampedArray {
    return glyphImageToRgba(this.nativeHandle, color);
  }
}

/** @internal */
export function glyphImageToRgba(image: number, color: Color): Uint8ClampedArray {
    const format = Module._TRGlyphImageGetFormat(image);
  const width = Module._TRGlyphImageGetWidth(image);
  const height = Module._TRGlyphImageGetHeight(image);
  const pixels = Module._TRGlyphImageGetPixelsPtr(image);
  const count = width * height;
  const rgba = new Uint8ClampedArray(count * 4);
  const heap = Module.HEAPU8;

  if (format === GlyphImageFormat.Alpha) {
    const alpha = Color.alpha(color) / 255;
    const red = Color.red(color);
    const green = Color.green(color);
    const blue = Color.blue(color);
    for (let index = 0; index < count; index++) {
      rgba[index * 4] = red;
      rgba[index * 4 + 1] = green;
      rgba[index * 4 + 2] = blue;
      rgba[index * 4 + 3] = (heap[pixels + index] ?? 0) * alpha;
    }
  } else {
    for (let index = 0; index < count; index++) {
      const base = pixels + index * 4;
      const a = heap[base] ?? 0;
      const divisor = a === 0 ? 1 : a;
      rgba[index * 4] = Math.min(255, ((heap[base + 1] ?? 0) * 255) / divisor);
      rgba[index * 4 + 1] = Math.min(255, ((heap[base + 2] ?? 0) * 255) / divisor);
      rgba[index * 4 + 2] = Math.min(255, ((heap[base + 3] ?? 0) * 255) / divisor);
      rgba[index * 4 + 3] = a;
    }
  }
  return rgba;
}
