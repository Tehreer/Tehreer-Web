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

/** A four-character tag of an SFNT table, script, language or feature, as an integer. */
export type SfntTag = number;

/** Functions to convert tags between strings and integers. */
export const SfntTag = {
  /**
   * Makes a tag from a string of up to four characters between U+0020 and U+007E, which is padded
   * with spaces on the right, so `"URD"` and `"URD "` are the same tag.
   *
   * @throws {RangeError} If the string is empty, longer than four characters or not printable ASCII.
   */
  make(text: string): SfntTag {
    if (text.length === 0 || text.length > 4 || !/^[\x20-\x7e]+$/.test(text)) {
      throw new RangeError(`Not a valid tag: "${text}"`);
    }
    const padded = text.padEnd(4, " ");
    return (
      ((padded.charCodeAt(0) << 24) |
        (padded.charCodeAt(1) << 16) |
        (padded.charCodeAt(2) << 8) |
        padded.charCodeAt(3)) >>>
      0
    );
  },

  /** Converts a tag to its four characters, without trimming the padding. */
  toString(tag: SfntTag): string {
    return String.fromCharCode((tag >>> 24) & 0xff, (tag >>> 16) & 0xff, (tag >>> 8) & 0xff, tag & 0xff);
  },
} as const;
