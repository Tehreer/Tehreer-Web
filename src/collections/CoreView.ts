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

import type { NativeObject } from "../internal/NativeObject.js";

/**
 * The base of the objects that read a struct of Core when their properties are read. The struct
 * belongs to an owner, which keeps it alive in Core, so they check that it is not disposed.
 *
 * @internal
 */
export abstract class CoreView<V> {
  readonly #owner: NativeObject;
  readonly #view: V;

  protected constructor(owner: NativeObject, view: V) {
    this.#owner = owner;
    this.#view = view;
  }

  /** The struct, if the owner is not disposed. */
  protected get core(): V {
    void this.#owner.nativeHandle;
    return this.#view;
  }

  protected get owner(): NativeObject {
    return this.#owner;
  }
}
