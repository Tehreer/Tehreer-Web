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
