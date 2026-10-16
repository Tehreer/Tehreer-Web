import { callbackPointers, collect } from "../internal/Callbacks.js";
import { Module } from "../internal/Module.js";
import type { TypeSlope, TypeWeight, TypeWidth } from "./enums.js";
import { matchTypeface, TypeFamily } from "./TypeFamily.js";
import { Typeface } from "./Typeface.js";

/**
 * The registry of typefaces that the whole page shares. It identifies typefaces by an integer tag,
 * groups them into families, and picks the typeface of a family that is closest to a style.
 *
 * A tag of 0 and a family ID of 0 mean none, so valid values start at 1. Whatever is registered
 * stays registered until it is unregistered, so tests must unregister what they register.
 */
export const TypefaceManager = {
  /**
   * Registers a typeface. The manager keeps its own reference until it is unregistered.
   *
   * @param tag The tag that identifies the typeface, or 0 for no tag.
   * @param familyId The ID of the family, or 0 to group it with the typefaces that have no family ID
   *     and the same family name.
   * @returns `false` if the typeface is already registered or the tag is already taken.
   */
  registerTypeface(typeface: Typeface, tag = 0, familyId = 0): boolean {
    return Module._TRTypefaceManagerRegisterTypeface(typeface.nativeHandle, tag, familyId) !== 0;
  },

  /** Unregisters a typeface, which frees its tag and family ID. Returns `false` if it is not registered. */
  unregisterTypeface(typeface: Typeface): boolean {
    return Module._TRTypefaceManagerUnregisterTypeface(typeface.nativeHandle) !== 0;
  },

  /** Returns the typeface that has a tag, or `undefined` if the tag is 0 or not taken. */
  getTypeface(tag: number): Typeface | undefined {
    const handle = Module._TRTypefaceManagerGetTypeface(tag);
    return handle === 0 ? undefined : Typeface.retaining(handle);
  },

  /** Returns the tag of a registered typeface, or 0 if it has none or is not registered. */
  getTypefaceTag(typeface: Typeface): number {
    return Module._TRTypefaceManagerGetTypefaceTag(typeface.nativeHandle);
  },

  /** Returns the family ID of a registered typeface, or 0 if it has none or is not registered. */
  getTypefaceFamilyId(typeface: Typeface): number {
    return Module._TRTypefaceManagerGetTypefaceFamilyID(typeface.nativeHandle);
  },

  /**
   * Returns the typeface that is closest to a style among those that are registered without a
   * family ID, with the family name compared ignoring the case of ASCII letters.
   */
  getTypefaceByStyle(
    familyName: string,
    width: TypeWidth,
    weight: TypeWeight | number,
    slope: TypeSlope,
  ): Typeface | undefined {
    return matchTypeface(0, familyName, width, weight, slope);
  },

  /** Returns the family with a name, or `undefined` if there is none. */
  getTypeFamily(familyName: string): TypeFamily | undefined {
    const lowered = familyName.toLowerCase();
    return TypefaceManager.getAvailableFamilies().find((family) => family.familyName.toLowerCase() === lowered);
  },

  /** Returns the registered typeface that has a full name, or `undefined` if there is none. */
  getTypefaceByName(fullName: string): Typeface | undefined {
    return TypefaceManager.getAvailableTypefaces().find((typeface) => typeface.fullName === fullName);
  },

  /** Returns the registered typefaces, ordered by family name and then by style name. */
  getAvailableTypefaces(): Typeface[] {
    const handles = collect<number>((context) =>
      Module._TRTypefaceManagerEnumerateTypefaces(callbackPointers().typefaceCallback, context),
    );
    return handles.map((handle) => Typeface.retaining(handle));
  },

  /** Returns the families of the registered typefaces, ordered by family name. */
  getAvailableFamilies(): TypeFamily[] {
    const families = collect<{ familyId: number; name: string }>((context) =>
      Module._TRTypefaceManagerEnumerateFamilies(callbackPointers().familyCallback, context),
    );
    return families.map((family) => new TypeFamily(family.name, family.familyId));
  },
} as const;

