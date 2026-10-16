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

/** A run of characters that have the same embedding level. */
export class BidiRun {
  constructor(
    /** The index of the first character of the run in the source text. */
    readonly startIndex: number,
    /** The index after the last character of the run in the source text. */
    readonly endIndex: number,
    /** The embedding level of the run. */
    readonly embeddingLevel: number,
  ) {}

  /** Tells whether the embedding level is odd, which makes the run right-to-left. */
  get isRightToLeft(): boolean {
    return (this.embeddingLevel & 1) === 1;
  }

  equals(other: BidiRun): boolean {
    return (
      this.startIndex === other.startIndex &&
      this.endIndex === other.endIndex &&
      this.embeddingLevel === other.embeddingLevel
    );
  }

  toString(): string {
    return `BidiRun{startIndex=${this.startIndex}, endIndex=${this.endIndex}, embeddingLevel=${this.embeddingLevel}}`;
  }
}
