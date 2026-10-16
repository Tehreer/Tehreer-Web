import { Module } from "../internal/Module.js";
import { withStack } from "../internal/Memory.js";
import { TRStringView } from "../internal/Structs.js";
import type { TypeSlope, TypeWeight, TypeWidth } from "./enums.js";
import { Typeface } from "./Typeface.js";

/** A group of typefaces that the typeface manager has registered under one family. */
export class TypeFamily {
  /** @internal */
  constructor(
    readonly familyName: string,
    /** @internal */
    readonly familyId: number,
  ) {}

  /**
   * Returns the typeface of the family that is closest to the style, as CSS Fonts Level 4 matches
   * them. Ties go to the typeface that was registered first.
   */
  getTypefaceByStyle(width: TypeWidth, weight: TypeWeight | number, slope: TypeSlope): Typeface | undefined {
    return matchTypeface(this.familyId, this.familyName, width, weight, slope);
  }

  equals(other: TypeFamily): boolean {
    return this.familyId === other.familyId && this.familyName === other.familyName;
  }

  toString(): string {
    return `TypeFamily(${this.familyName})`;
  }
}

/** @internal */
export function matchTypeface(
  familyId: number,
  familyName: string,
  width: number,
  weight: number,
  slope: number,
): Typeface | undefined {
    let handle = 0;
  if (familyId !== 0) {
    handle = Module._TRTypefaceManagerGetMatchingTypefaceByFamilyID(familyId, width, weight, slope);
  } else {
    handle = withStack((stack) => {
      const bytes = new TextEncoder().encode(familyName);
      const name = stack.alloc(bytes.length + 1);
      Module.HEAPU8.set(bytes, name);
      // A view of UTF-8 code units, whose encoding is 0.
      const view = TRStringView.allocate(stack, { buffer: name, length: bytes.length, encoding: 0 });
      return Module._TRTypefaceManagerGetMatchingTypefaceByFamilyName(view, width, weight, slope);
    });
  }
  return handle === 0 ? undefined : Typeface.retaining(handle);
}
