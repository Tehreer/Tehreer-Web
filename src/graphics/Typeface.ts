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

import type { Float, UInt32 } from "../collections/NumberKind.js";
import { CoreList, coreNumbers } from "../collections/CoreList.js";
import type { List, NumberList } from "../collections/List.js";
import type { Color } from "../Color.js";
import type { AffineTransform, Rect } from "../geometry.js";
import { adopt } from "../internal/Adopt.js";
import { copyBytes, withStack } from "../internal/Memory.js";
import { Module } from "../internal/Module.js";
import { NativeObject } from "../internal/NativeObject.js";
import { f32, u32, withValues } from "../internal/Struct.js";
import {
  TRAffineTransform, TRBitmapStrike, TRNamedStyle, TRPaletteEntry, TRPredefinedPalette, TRRect, TRVariationAxis,
  readOptionalStringView,
} from "../internal/Structs.js";
import type { SfntTag } from "../sfnt/SfntTag.js";
import type { BitmapStrike } from "./BitmapStrike.js";
import { CoreColorPalette, type ColorPalette } from "./ColorPalette.js";
import type { TypeSlope, TypeWidth } from "./enums.js";
import { CoreNamedStyle, type NamedStyle } from "./NamedStyle.js";
import { Path } from "./Path.js";
import { CoreVariationAxis, type VariationAxis } from "./VariationAxis.js";

const GLYPH_NAME_CAPACITY = 256;

/**
 * A face of a font, at a size that is chosen when it is used. Typefaces come from `FontFile`, or
 * are made from another one by `getVariationInstance()` and `getColorInstance()`.
 *
 * A typeface is immutable and can be shared freely. All sizes of the metrics are in font units
 * unless the member says otherwise.
 */
export class Typeface extends NativeObject {
  /** @internal */
  constructor(token: typeof adopt, handle: number) {
    super(handle, (h) => Module._TRTypefaceRelease(h));
    void token;
  }

  /**
   * Makes a wrapper for a typeface that Core does not retain for the caller.
   *
   * @internal
   */
  static retaining(handle: number): Typeface {
    return new Typeface(adopt, Module._TRTypefaceRetain(handle));
  }

  /** Makes a wrapper for a typeface that Core created for the caller. @internal */
  static adopting(handle: number): Typeface {
    return new Typeface(adopt, handle);
  }

  get weight(): number {
    return Module._TRTypefaceGetWeight(this.nativeHandle);
  }

  get width(): TypeWidth {
    return Module._TRTypefaceGetWidth(this.nativeHandle);
  }

  get slope(): TypeSlope {
    return Module._TRTypefaceGetSlope(this.nativeHandle);
  }

  get unitsPerEm(): number {
    return Module._TRTypefaceGetUnitsPerEM(this.nativeHandle);
  }

  /** The distance from the baseline to the top of the typeface. */
  get ascent(): number {
    return Module._TRTypefaceGetAscent(this.nativeHandle);
  }

  /** The distance from the baseline to the bottom of the typeface. */
  get descent(): number {
    return Module._TRTypefaceGetDescent(this.nativeHandle);
  }

  /** The extra space between the lines. */
  get leading(): number {
    return Module._TRTypefaceGetLeading(this.nativeHandle);
  }

  get glyphCount(): number {
    return Module._TRTypefaceGetGlyphCount(this.nativeHandle);
  }

  /** The box that contains all glyphs, with the y axis pointing up. */
  get boundingBox(): Rect {
    const handle = this.nativeHandle;
    return TRRect.returning((ret) => Module._TRTypefaceGetBoundingBox(ret, handle));
  }

  get underlinePosition(): number {
    return Module._TRTypefaceGetUnderlinePosition(this.nativeHandle);
  }

  get underlineThickness(): number {
    return Module._TRTypefaceGetUnderlineThickness(this.nativeHandle);
  }

  /** The position of the strikeout, which is zero if the font has no `OS/2` table. */
  get strikeoutPosition(): number {
    return Module._TRTypefaceGetStrikeoutPosition(this.nativeHandle);
  }

  get strikeoutThickness(): number {
    return Module._TRTypefaceGetStrikeoutThickness(this.nativeHandle);
  }

  get familyName(): string | undefined {
    return readOptionalStringView(Module._TRTypefaceGetFamilyName(this.nativeHandle));
  }

  /** The style name, such as "Bold Italic", which the font calls the subfamily name. */
  get styleName(): string | undefined {
    return readOptionalStringView(Module._TRTypefaceGetStyleName(this.nativeHandle));
  }

  get fullName(): string | undefined {
    return readOptionalStringView(Module._TRTypefaceGetFullName(this.nativeHandle));
  }

  /** Tells whether the glyphs have outlines, or only images at the sizes of the bitmap strikes. */
  get isScalable(): boolean {
    return Module._TRTypefaceIsScalable(this.nativeHandle) !== 0;
  }

  get isVariable(): boolean {
    return Module._TRTypefaceIsVariable(this.nativeHandle) !== 0;
  }

  /** The axes of a variable font, which is empty for any other font. */
  get variationAxes(): List<VariationAxis> {
    const handle = this.nativeHandle;
    return new CoreList(
      this,
      Module._TRTypefaceGetVariationAxesPtr(handle),
      Module._TRTypefaceGetVariationAxisCount(handle),
      { size: TRVariationAxis.size, read: (address) => new CoreVariationAxis(this, address) },
    );
  }

  /** The coordinates that the typeface uses, in the order of the axes. */
  get variationCoordinates(): NumberList<Float> {
    const handle = this.nativeHandle;
    return coreNumbers(
      this,
      Module._TRTypefaceGetVariationCoordinatesPtr(handle),
      Module._TRTypefaceGetVariationAxisCount(handle),
      f32,
    );
  }

  /** The named instances of a variable font, which is empty for any other font. */
  get namedStyles(): List<NamedStyle> {
    const handle = this.nativeHandle;
    return new CoreList(
      this,
      Module._TRTypefaceGetNamedStylesPtr(handle),
      Module._TRTypefaceGetNamedStyleCount(handle),
      { size: TRNamedStyle.size, read: (address) => new CoreNamedStyle(this, address) },
    );
  }

  /** The names of the palette entries of a color font, which is empty for any other font. */
  get paletteEntryNames(): List<string | undefined> {
    const handle = this.nativeHandle;
    return new CoreList(
      this,
      Module._TRTypefaceGetPaletteEntriesPtr(handle),
      Module._TRTypefaceGetPaletteEntryCount(handle),
      { size: TRPaletteEntry.size, read: (address) => TRPaletteEntry.view(address).name },
    );
  }

  /** The palettes that a color font defines. */
  get predefinedPalettes(): List<ColorPalette> {
    const handle = this.nativeHandle;
    return new CoreList(
      this,
      Module._TRTypefaceGetPredefinedPalettesPtr(handle),
      Module._TRTypefaceGetPredefinedPaletteCount(handle),
      { size: TRPredefinedPalette.size, read: (address) => new CoreColorPalette(this, address) },
    );
  }

  /** The colors that the typeface uses for its palette entries, in order. */
  get associatedColors(): NumberList<UInt32> {
    const handle = this.nativeHandle;
    return coreNumbers(
      this,
      Module._TRTypefaceGetAssociatedColorsPtr(handle),
      Module._TRTypefaceGetPaletteEntryCount(handle),
      u32,
    );
  }

  /** The sizes at which the typeface has images of its glyphs. */
  get bitmapStrikes(): List<BitmapStrike> {
    const handle = this.nativeHandle;
    return new CoreList(
      this,
      Module._TRTypefaceGetBitmapStrikesPtr(handle),
      Module._TRTypefaceGetBitmapStrikeCount(handle),
      { size: TRBitmapStrike.size, read: (address) => TRBitmapStrike.snapshot(address) },
    );
  }

  /**
   * Makes the typeface at the given coordinates of a variable font, each of which is clamped to
   * its axis. Coordinates that are missing take the default values of their axes.
   *
   * @returns The new typeface, or `undefined` if the typeface has no variation axes.
   */
  getVariationInstance(coordinates: ArrayLike<number>): Typeface | undefined {
    const handle = this.nativeHandle;
    const created = withValues(f32, coordinates, (pointer) =>
      Module._TRTypefaceCreateWithVariation(handle, pointer, coordinates.length),
    );
    return created === 0 ? undefined : Typeface.adopting(created);
  }

  /**
   * Makes the typeface with other colors for its palette entries.
   *
   * @returns The new typeface, or `undefined` if the typeface has no palette entries.
   */
  getColorInstance(colors: ArrayLike<Color>): Typeface | undefined {
    const handle = this.nativeHandle;
    const created = withValues(u32, colors, (pointer) =>
      Module._TRTypefaceCreateWithColors(handle, pointer, colors.length),
    );
    return created === 0 ? undefined : Typeface.adopting(created);
  }

  /** Returns the glyph that represents a code point, or 0 (the missing glyph) if there is none. */
  getGlyphId(codePoint: number): number {
    return Module._TRTypefaceGetGlyphID(this.nativeHandle, codePoint);
  }

  /** Returns the glyph of a code point followed by a variation selector, or 0 if there is none. */
  getVariantGlyphId(codePoint: number, variantSelector: number): number {
    return Module._TRTypefaceGetVariantGlyphID(this.nativeHandle, codePoint, variantSelector);
  }

  /**
   * Returns the unhinted advance of a glyph, in the unit of the type size.
   *
   * @param isVertical Asks for the vertical advance.
   */
  getGlyphAdvance(glyphId: number, typeSize: number, isVertical = false): number {
    return Module._TRTypefaceGetGlyphAdvance(this.nativeHandle, glyphId, typeSize, isVertical ? 1 : 0);
  }

  /**
   * Makes the outline of a glyph, whose origin is the pen position on the baseline, with the y
   * axis pointing downward.
   *
   * @returns The outline, or `undefined` if the type size is not positive or the glyph has none.
   */
  getGlyphPath(glyphId: number, typeSize: number, transform?: AffineTransform): Path | undefined {
    const created = Module._TRTypefaceCreateGlyphPath(this.nativeHandle, glyphId, typeSize);
    return created === 0 ? undefined : Path.takeNative(created, transform);
  }

  /** Returns the size of a table in bytes, which is zero if the font has no such table. */
  getTableSize(tag: SfntTag): number {
    return Module._TRTypefaceGetTableSize(this.nativeHandle, tag);
  }

  /**
   * Copies a part of a table of the font. Only the part that is asked for is read.
   *
   * @param length The number of bytes to copy, which is the rest of the table by default.
   * @returns The bytes, or `undefined` if the font has no such table.
   */
  getTableData(tag: SfntTag, offset = 0, length?: number): Uint8Array | undefined {
        const handle = this.nativeHandle;
    const size = Module._TRTypefaceGetTableSize(handle, tag);
    if (size === 0) {
      return undefined;
    }

    const capacity = Math.max(0, Math.min(length ?? size, size - offset));
    if (capacity === 0) {
      return new Uint8Array(0);
    }
    const buffer = Module._malloc(capacity);
    try {
      const copied = Module._TRTypefaceGetTableData(handle, tag, offset, buffer, capacity);
      return copyBytes(buffer, copied);
    } finally {
      Module._free(buffer);
    }
  }

  /** Returns the name that the font gives to a glyph, or `undefined` if it gives none. */
  getGlyphName(glyphId: number): string | undefined {
    return withStack((stack) => {
      const buffer = stack.alloc(GLYPH_NAME_CAPACITY);
      const length = Module._TRTypefaceGetGlyphName(this.nativeHandle, glyphId, buffer, GLYPH_NAME_CAPACITY);
      return length === 0 ? undefined : String.fromCharCode(...Module.HEAPU8.subarray(buffer, buffer + length));
    });
  }

  override toString(): string {
    return `Typeface(${this.fullName ?? this.familyName ?? "unnamed"})`;
  }
}

