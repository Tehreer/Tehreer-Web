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

/** An unsigned 8-bit integer, as the kind of the numbers of a `NumberList`. */
export type UInt8 = "UInt8";
/** An unsigned 16-bit integer, such as a glyph ID. */
export type UInt16 = "UInt16";
/** A signed 32-bit integer. */
export type Int32 = "Int32";
/** An unsigned 32-bit integer, such as a color or an index. */
export type UInt32 = "UInt32";
/** A 32-bit floating point number. */
export type Float = "Float";

/** The typed array that holds numbers of each kind. */
export interface TypedArrays {
  UInt8: Uint8Array;
  UInt16: Uint16Array;
  Int32: Int32Array;
  UInt32: Uint32Array;
  Float: Float32Array;
}

/** The kinds of numbers that a list can have. */
export type NumberKind = keyof TypedArrays;
