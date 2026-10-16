import { Module } from "../internal/Module.js";
import type { BidiClass, GeneralCategory, Script } from "./enums.js";

/** Properties of a Unicode code point. */
export const CodePoint = {
  /** Returns the bidi class of a code point. */
  getBidiClass(codePoint: number): BidiClass {
    return Module._SBCodepointGetBidiType(codePoint);
  },

  /** Returns the general category of a code point. */
  getGeneralCategory(codePoint: number): GeneralCategory {
    return Module._SBCodepointGetGeneralCategory(codePoint);
  },

  /** Returns the script of a code point. */
  getScript(codePoint: number): Script {
    return Module._SBCodepointGetScript(codePoint);
  },

  /** Returns the mirror of a code point, or 0 if it has none. */
  getMirror(codePoint: number): number {
    return Module._SBCodepointGetMirror(codePoint) >>> 0;
  },
} as const;
