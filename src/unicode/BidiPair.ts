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

/** A character that has to be replaced by its mirror when it is drawn in a right-to-left run. */
export class BidiPair {
  constructor(
    /** The index of the character in the source text. */
    readonly charIndex: number,
    /** The code point of the character in the source text. */
    readonly actualCodePoint: number,
    /** The code point of the character that forms a pair with it, which is its mirror. */
    readonly pairingCodePoint: number,
  ) {}

  equals(other: BidiPair): boolean {
    return (
      this.charIndex === other.charIndex &&
      this.actualCodePoint === other.actualCodePoint &&
      this.pairingCodePoint === other.pairingCodePoint
    );
  }

  toString(): string {
    return `BidiPair{charIndex=${this.charIndex}, actualCodePoint=${this.actualCodePoint}, pairingCodePoint=${this.pairingCodePoint}}`;
  }
}
