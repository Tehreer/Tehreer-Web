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

import type { NativeFunctions } from "./NativeFunctions.js";

/** The WebAssembly module: the functions of Core and the parts of the Emscripten runtime that are used. */
export interface TehreerModule extends NativeFunctions {
  HEAP8: Int8Array;
  HEAPU8: Uint8Array;
  HEAP16: Int16Array;
  HEAPU16: Uint16Array;
  HEAP32: Int32Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  _malloc(size: number): number;
  _free(pointer: number): void;
  _tw_version(): number;
  /** Writes the sizes and the offsets of the structs of Core as JSON, which the tests compare with `Structs`. */
  _tw_layout(buffer: number, capacity: number): number;
  addFunction(callback: (...args: never[]) => unknown, signature: string): number;
  removeFunction(pointer: number): void;
  stackSave(): number;
  stackRestore(stackPointer: number): void;
  stackAlloc(size: number): number;
}

const NOT_INITIALIZED = "Tehreer is not initialized: await initialize() before using it.";

// Until the module is loaded, every use of it fails with a message that says what to do.
const unavailable = new Proxy({} as TehreerModule, {
  get(_target, property) {
    if (property === "then") {
      return undefined;
    }
    throw new Error(NOT_INITIALIZED);
  },
});

/**
 * The WebAssembly module. It is an ES module binding, so it is the loaded module in every file
 * that imports it as soon as `initialize()` is done, and it fails to be used before that.
 */
export let Module: TehreerModule = unavailable;

/** Makes the module the one that all objects use. */
export function setModule(module: TehreerModule): void {
  Module = module;
}
