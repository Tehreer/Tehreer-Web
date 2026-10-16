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

import type { UInt32 } from "../collections/NumberKind.js";
import { CoreView } from "../collections/CoreView.js";
import { coreNumbers } from "../collections/CoreList.js";
import type { NumberList } from "../collections/List.js";
import type { NativeObject } from "../internal/NativeObject.js";
import { u32 } from "../internal/Struct.js";
import { TRPredefinedPalette } from "../internal/Structs.js";

/** A palette of a color font, which a typeface can be switched to. */
export interface ColorPalette {
  readonly name: string | undefined;
  /** The flags of the palette, which tell if it suits a light or a dark background. */
  readonly flags: number;
  /** The color of each palette entry of the typeface, in order. */
  readonly colors: NumberList<UInt32>;
}

/** A palette that is read from the memory of Core when its properties are read. @internal */
export class CoreColorPalette extends CoreView<ReturnType<typeof TRPredefinedPalette.view>> implements ColorPalette {
  constructor(owner: NativeObject, address: number) {
    super(owner, TRPredefinedPalette.view(address));
  }

  get name(): string | undefined {
    return this.core.name;
  }

  get flags(): number {
    return this.core.flags;
  }

  get colors(): NumberList<UInt32> {
    const palette = this.core;
    return coreNumbers(this.owner, palette.colorsPtr, palette.colorCount, u32);
  }
}
