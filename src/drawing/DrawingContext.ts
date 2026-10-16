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

/**
 * The 2D context of a canvas that text is drawn into: of an `HTMLCanvasElement` or of an
 * `OffscreenCanvas`.
 *
 * Core multiplies every position by the render scale of the renderer before it gives it to the
 * context, and the transform of the context is applied after that, so use a render scale of 1
 * with a context that is scaled for the pixel ratio, or the pixel ratio with one that is not.
 */
export type DrawingContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
