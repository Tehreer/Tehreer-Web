import type { SfntTag } from "../sfnt/SfntTag.js";
import { Module } from "../internal/Module.js";

/** @internal */
export function getScriptOpenTypeTag(script: number): SfntTag {
  return Module._SBScriptGetOpenTypeTag(script) >>> 0;
}

/** @internal */
export function getScriptUnicodeTag(script: number): SfntTag {
  return Module._SBScriptGetUnicodeTag(script) >>> 0;
}
