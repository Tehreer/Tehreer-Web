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

import { free, malloc, StringEncodingUTF16, withStack } from "../internal/Memory.js";
import { Module } from "../internal/Module.js";
import { SBCodepointSequence } from "../internal/Structs.js";

/**
 * The UTF-16 copy of the text that a bidi algorithm works on. SheenBidi does not own it, and the
 * paragraphs and the lines need it as long as they live (the mirror locator reads characters from
 * it), so it is counted: it is freed when the last of them lets it go.
 *
 * @internal
 */
export class BidiBuffer {
  #retainCount = 1;

  private constructor(
    readonly address: number,
    readonly length: number,
  ) {}

  static create(text: string): BidiBuffer {
    const length = text.length;
    const address = malloc(length * 2);
    // A view is taken after the allocation, as it could have grown the memory.
    const units = Module.HEAPU16;
    const start = address >> 1;
    for (let index = 0; index < length; index++) {
      units[start + index] = text.charCodeAt(index);
    }
    return new BidiBuffer(address, length);
  }

  retain(): this {
    this.#retainCount++;
    return this;
  }

  release(): void {
    if (--this.#retainCount === 0) {
      free(this.address);
    }
  }
}

/** Runs a body with the `SBCodepointSequence` of UTF-16 code units. @internal */
export function withCodepointSequence<T>(address: number, length: number, body: (sequence: number) => T): T {
  return withStack((stack) =>
    body(
      SBCodepointSequence.allocate(stack, {
        stringEncoding: StringEncodingUTF16,
        stringBuffer: address,
        stringLength: length,
      }),
    ),
  );
}
