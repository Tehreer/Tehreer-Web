import { IndexedList } from "../collections/CoreList.js";
import type { List } from "../collections/List.js";
import { adopt } from "../internal/Adopt.js";
import { NativeObject } from "../internal/NativeObject.js";
import { malloc, free } from "../internal/Memory.js";
import { Module } from "../internal/Module.js";
import { checkCreated } from "../internal/Validation.js";
import { Typeface } from "./Typeface.js";

/**
 * A font file, such as a TrueType, OpenType or collection file, which has one or more typefaces.
 *
 * The data of the file is copied by Core, so the buffer that it was made from can be reused.
 * Typefaces keep the data alive, so they stay valid after the font file is disposed.
 */
export class FontFile extends NativeObject {
  /**
   * Reads a font file from its bytes.
   *
   * @throws {Error} If the data does not contain a usable font.
   */
  constructor(data: ArrayBuffer | ArrayBufferView);
  /** @internal */
  constructor(token: typeof adopt, handle: number);
  constructor(source: ArrayBuffer | ArrayBufferView | typeof adopt, handle?: number) {
    super(
      source === adopt ? (handle as number) : FontFile.#create(source),
      (h) => Module._TRFontFileRelease(h),
    );
  }

  static #create(data: ArrayBuffer | ArrayBufferView): number {
    const bytes = ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data);
        const memory = malloc(bytes.length);
    try {
      Module.HEAPU8.set(bytes, memory);
      return checkCreated(Module._TRFontFileCreateFromMemory(memory, bytes.length), "a font file from the data");
    } finally {
      free(memory);
    }
  }

  /** Downloads a font file, and reads it. */
  static async fromUrl(url: string | URL, init?: RequestInit): Promise<FontFile> {
    const response = await fetch(url, init);
    if (!response.ok) {
      throw new Error(`Could not fetch the font: ${url} (${response.status} ${response.statusText})`);
    }
    return new FontFile(await response.arrayBuffer());
  }

  /**
   * The typefaces of the file, one for each face and one for each named style of a face that has
   * them. There is always at least one.
   */
  get typefaces(): List<Typeface> {
    return new IndexedList(this, Module._TRFontFileGetTypefaceCount(this.nativeHandle), (index) =>
      Typeface.retaining(Module._TRFontFileGetTypeface(this.nativeHandle, index)),
    );
  }
}
