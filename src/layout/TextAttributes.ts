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

import type { Color } from "../Color.js";
import type { Typeface } from "../graphics/Typeface.js";
import type { FontFeatures } from "../sfnt/FontFeatures.js";
import type { OpenTypeFeature } from "../sfnt/OpenTypeFeature.js";
import type { SfntTag } from "../sfnt/SfntTag.js";
import type { TextAlignment } from "./enums.js";
import type { Replacement } from "./Replacement.js";

/** The attributes that apply to a run of text. A member that is missing is not set. */
export interface RunAttributes {
  readonly typeface?: Typeface;
  /** The size of the em square, in the user space. */
  readonly typeSize?: number;
  readonly scaleX?: number;
  readonly scaleY?: number;
  /** How far to move the baseline up, which is negative to move it down. */
  readonly baselineOffset?: number;
  /** The horizontal shear of the glyphs, as a ratio of the horizontal shift to the height. */
  readonly obliqueness?: number;
  /** What replaces the run. */
  readonly replacement?: Replacement;
  readonly foregroundColor?: Color;
  readonly backgroundColor?: Color;
  readonly underline?: boolean;
  readonly strikethrough?: boolean;
  readonly decorationColor?: Color;
  /** An integer that the application chooses, which glyph runs give back. */
  readonly userData?: number;
  /** The OpenType language tag; see `ShapingEngine.getLanguageTag()`. */
  readonly languageTag?: SfntTag;
  /** The features to shape with. Reading them gives a `FontFeatures`. */
  readonly fontFeatures?: FontFeatures | readonly OpenTypeFeature[];
}

/** The attributes that apply to a whole paragraph. A member that is missing is not set. */
export interface ParagraphAttributes {
  readonly textAlignment?: TextAlignment;
  readonly firstLineHeadIndent?: number;
  readonly headIndent?: number;
  readonly tailIndent?: number;
  /** The number of lines that the first line head indent applies to. */
  readonly firstIndentLineCount?: number;
  readonly paragraphSpacingBefore?: number;
  readonly paragraphSpacing?: number;
  readonly lineHeightMultiple?: number;
  readonly minimumLineHeight?: number;
  readonly maximumLineHeight?: number;
  readonly lineSpacing?: number;
}

/** All attributes of text. */
export type TextAttributes = RunAttributes & ParagraphAttributes;

/** The name of an attribute. */
export type TextAttributeName = keyof TextAttributes;

/** What attributes stay the same over a stretch of text. */
export interface TextAttributeRun {
  readonly attributes: TextAttributes;
  /** The number of code units, from the index that was asked for, that the attributes cover. */
  readonly length: number;
}
