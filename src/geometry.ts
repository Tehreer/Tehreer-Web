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

/** A point in two dimensions. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A size in two dimensions. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** A rectangle, whose origin is its top-left corner when the y axis points downward. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * An affine transform, which maps `(x, y)` to `(a * x + c * y + tx, b * x + d * y + ty)`. The
 * members have the meaning that they have in `DOMMatrix` and in `CanvasRenderingContext2D`.
 */
export interface AffineTransform {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;
}
