/**
 * The 2D context of a canvas that text is drawn into: of an `HTMLCanvasElement` or of an
 * `OffscreenCanvas`.
 *
 * Core multiplies every position by the render scale of the renderer before it gives it to the
 * context, and the transform of the context is applied after that, so use a render scale of 1
 * with a context that is scaled for the pixel ratio, or the pixel ratio with one that is not.
 */
export type DrawingContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
