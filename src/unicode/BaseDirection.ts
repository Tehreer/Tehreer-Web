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

/** The base direction of a paragraph, which are also the values of the levels that SheenBidi takes. */
export enum BaseDirection {
  /** The paragraph is left-to-right (level 0). */
  LeftToRight = 0,
  /** The paragraph is right-to-left (level 1). */
  RightToLeft = 1,
  /**
   * The direction is the one of the first strong character of the paragraph, as the Unicode
   * Bidirectional Algorithm says. Without a strong character, it is left-to-right.
   */
  DefaultLeftToRight = 0xfe,
  /**
   * The direction is the one of the first strong character of the paragraph, as the Unicode
   * Bidirectional Algorithm says. Without a strong character, it is right-to-left.
   */
  DefaultRightToLeft = 0xfd,
}

/** The greatest explicit embedding level. */
export const MAX_BIDI_LEVEL = 125;
