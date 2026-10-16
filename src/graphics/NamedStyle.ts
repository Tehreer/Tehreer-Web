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

import type { Float } from "../collections/NumberKind.js";
import { CoreView } from "../collections/CoreView.js";
import { coreNumbers } from "../collections/CoreList.js";
import type { NumberList } from "../collections/List.js";
import type { NativeObject } from "../internal/NativeObject.js";
import { f32 } from "../internal/Struct.js";
import { TRNamedStyle } from "../internal/Structs.js";

/** A named instance of a variable font, such as "Bold". */
export interface NamedStyle {
  readonly styleName: string | undefined;
  /** The variation coordinates in the order of the variation axes of the typeface. */
  readonly coordinates: NumberList<Float>;
  readonly postScriptName: string | undefined;
}

/** A style that is read from the memory of Core when its properties are read. @internal */
export class CoreNamedStyle extends CoreView<ReturnType<typeof TRNamedStyle.view>> implements NamedStyle {
  constructor(owner: NativeObject, address: number) {
    super(owner, TRNamedStyle.view(address));
  }

  get styleName(): string | undefined {
    return this.core.subfamilyName;
  }

  get coordinates(): NumberList<Float> {
    const style = this.core;
    return coreNumbers(this.owner, style.coordinatesPtr, style.coordinateCount, f32);
  }

  get postScriptName(): string | undefined {
    return this.core.postScriptName;
  }
}
