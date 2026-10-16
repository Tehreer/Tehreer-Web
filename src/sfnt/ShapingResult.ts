import type { Float, UInt16, UInt32 } from "../collections/NumberKind.js";
import { coreNumbers, corePoints } from "../collections/CoreList.js";
import type { NumberList, PointList } from "../collections/List.js";
import { adopt } from "../internal/Adopt.js";
import { free, malloc } from "../internal/Memory.js";
import { Module } from "../internal/Module.js";
import { NativeObject } from "../internal/NativeObject.js";
import { f32, ptr, u16, u8 } from "../internal/Struct.js";

/**
 * The glyphs that the shaping engine made for a run of text. The lists read the memory of Core
 * when they are read, so they are valid while the result is not disposed.
 */
export class ShapingResult extends NativeObject {
  /** @internal */
  constructor(token: typeof adopt, handle: number) {
    super(handle, (h) => Module._TRShapingResultRelease(h));
    void token;
  }

  /** @internal */
  static adopting(handle: number): ShapingResult {
    return new ShapingResult(adopt, handle);
  }

  /** The number of code units that were shaped. */
  get codeUnitCount(): number {
    return Module._TRShapingResultGetCodeUnitCount(this.nativeHandle);
  }

  /** Tells whether the glyphs are in the reverse order of the code units. */
  get isBackward(): boolean {
    return Module._TRShapingResultIsBackward(this.nativeHandle) !== 0;
  }

  get isRTL(): boolean {
    return Module._TRShapingResultIsRTL(this.nativeHandle) !== 0;
  }

  get glyphCount(): number {
    return Module._TRShapingResultGetGlyphCount(this.nativeHandle);
  }

  /** The ID of each glyph, in the order of the writing direction. */
  get glyphIds(): NumberList<UInt16> {
    const handle = this.nativeHandle;
    return coreNumbers(this, Module._TRShapingResultGetGlyphIDsPtr(handle), this.glyphCount, u16);
  }

  /** The offset of each glyph from its pen position, with the y axis pointing up. */
  get glyphOffsets(): PointList {
    const handle = this.nativeHandle;
    return corePoints(this, Module._TRShapingResultGetGlyphOffsetsPtr(handle), this.glyphCount);
  }

  get glyphAdvances(): NumberList<Float> {
    const handle = this.nativeHandle;
    return coreNumbers(this, Module._TRShapingResultGetGlyphAdvancesPtr(handle), this.glyphCount, f32);
  }

  /** The index of the glyph of each code unit, which is the first glyph of its cluster. */
  get clusterMap(): NumberList<UInt32> {
    const handle = this.nativeHandle;
    return coreNumbers(this, Module._TRShapingResultGetClusterMapPtr(handle), this.codeUnitCount, ptr);
  }

  /**
   * Computes the distance from the start of the run to each code unit boundary, measured along
   * the writing direction. The advance of a cluster is divided evenly between the caret stops
   * inside it.
   *
   * @param caretStops Tells for each code unit whether the caret can stop before it. It has to
   *     have a flag for each code unit. A stop is allowed at every code unit by default.
   * @returns The edges, which are one more than the code units.
   */
  getCaretEdges(caretStops?: ArrayLike<boolean | number>): Float32Array {
    const handle = this.nativeHandle;
    const count = Module._TRShapingResultGetCodeUnitCount(handle);
    if (caretStops !== undefined && caretStops.length < count) {
      throw new RangeError("There must be a caret stop flag for each code unit.");
    }

    const stops = caretStops === undefined ? 0 : malloc(count);
    const edges = malloc((count + 1) * f32.size);
    try {
      if (caretStops !== undefined) {
        for (let index = 0; index < count; index++) {
          u8.write(stops + index, caretStops[index] ? 1 : 0);
        }
      }
      Module._TRShapingResultGetCaretEdges(handle, stops, edges);
      return f32.copy(edges, count + 1);
    } finally {
      free(edges);
      if (stops !== 0) {
        free(stops);
      }
    }
  }
}
