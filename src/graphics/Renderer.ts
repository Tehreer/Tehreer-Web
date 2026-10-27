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

import { coreBufferOf, pointReader } from "../collections/CoreList.js";
import { List } from "../collections/List.js";
import type { Color } from "../Color.js";
import { CanvasPainter } from "../drawing/CanvasPainter.js";
import { SvgPainter } from "../drawing/SvgPainter.js";
import type { DrawingContext } from "../drawing/DrawingContext.js";
import type { Point, Rect } from "../geometry.js";
import { adopt } from "../internal/Adopt.js";
import { callingBack, callbackPointers, collect, drawTargets, pathSinks, type DrawTarget } from "../internal/Callbacks.js";
import { NativeObject } from "../internal/NativeObject.js";
import { free, malloc } from "../internal/Memory.js";
import { f32, u16, withValues, type Field } from "../internal/Struct.js";
import { TRPoint, TRRect } from "../internal/Structs.js";
import { Module } from "../internal/Module.js";
import { checkCreated } from "../internal/Validation.js";
import { WritingDirection } from "../sfnt/enums.js";
import { DrawStyle, GlyphImageKind, StrokeCap, StrokeJoin } from "./enums.js";
import { GlyphCache } from "./GlyphCache.js";
import { GlyphImage } from "./GlyphImage.js";
import { Path } from "./Path.js";
import { Typeface } from "./Typeface.js";

/** The glyphs of a run, which a `ShapingResult` and a `GlyphRun` have. */
export interface GlyphBuffers {
  /** The IDs of the glyphs, in the order of the writing direction. */
  readonly glyphIds: List<number> | ArrayLike<number>;
  /** The offsets of the glyphs from their pen positions, with the y axis up. */
  readonly glyphOffsets: List<Point> | ArrayLike<Point>;
  /** The advances of the glyphs. */
  readonly glyphAdvances: List<number> | ArrayLike<number>;
}

/** The image of a glyph and where to draw it. */
export interface GlyphPlacement {
  /** The index of the glyph in the run. */
  readonly glyphIndex: number;
  /** The image, which the caller owns and has to dispose. */
  readonly image: GlyphImage;
  /** The position of the top-left corner of the image, in whole pixels. */
  readonly x: number;
  readonly y: number;
  /** How much to scale the image to match the size that was asked for. */
  readonly scaleX: number;
  readonly scaleY: number;
}

/**
 * Describes how glyphs are measured and drawn: the typeface, the size, the colors, the stroke and
 * the shadow. It is a configuration object, so it is not thread safe, and changing it while a
 * glyph run, line or frame is being drawn with it is not allowed.
 *
 * It is created with these values: a type size of 16, no scaling, no skew, a render scale of 1,
 * left to right, an opaque black foreground color, and a stroke of radius 0.5 with butt caps,
 * round joins and a miter limit of 1 in opaque black. It fills glyphs. The typeface has to be set.
 */
export class Renderer extends NativeObject {
  constructor() {
    super(checkCreated(Module._TRRendererCreate(), "a renderer"), (h) => Module._TRRendererRelease(h));
  }

  /** The typeface of the glyphs, which has to be set before the renderer is used. */
  get typeface(): Typeface | undefined {
    const handle = Module._TRRendererGetTypeface(this.nativeHandle);
    return handle === 0 ? undefined : Typeface.retaining(handle);
  }

  set typeface(value: Typeface | undefined) {
    Module._TRRendererSetTypeface(this.nativeHandle, value === undefined ? 0 : value.nativeHandle);
  }

  /** The cache of glyph images, which is `GlyphCache.default` until another one is set. */
  get glyphCache(): GlyphCache {
    const handle = Module._TRRendererGetGlyphCache(this.nativeHandle);
    return new GlyphCache(adopt, Module._TRGlyphCacheRetain(handle));
  }

  set glyphCache(value: GlyphCache) {
    Module._TRRendererSetGlyphCache(this.nativeHandle, value.nativeHandle);
  }

  /** The size of the em square, in the user space. */
  get typeSize(): number {
    return Module._TRRendererGetTypeSize(this.nativeHandle);
  }

  set typeSize(value: number) {
    Module._TRRendererSetTypeSize(this.nativeHandle, value);
  }

  get scaleX(): number {
    return Module._TRRendererGetScaleX(this.nativeHandle);
  }

  set scaleX(value: number) {
    Module._TRRendererSetScaleX(this.nativeHandle, value);
  }

  get scaleY(): number {
    return Module._TRRendererGetScaleY(this.nativeHandle);
  }

  set scaleY(value: number) {
    Module._TRRendererSetScaleY(this.nativeHandle, value);
  }

  /** The horizontal shear of the glyphs, as a ratio of the horizontal shift to the height. */
  get skewX(): number {
    return Module._TRRendererGetSkewX(this.nativeHandle);
  }

  set skewX(value: number) {
    Module._TRRendererSetSkewX(this.nativeHandle, value);
  }

  /** The factor that distances are multiplied by before they are drawn, such as the pixel ratio. */
  get renderScale(): number {
    return Module._TRRendererGetRenderScale(this.nativeHandle);
  }

  set renderScale(value: number) {
    Module._TRRendererSetRenderScale(this.nativeHandle, value);
  }

  get writingDirection(): WritingDirection {
    return Module._TRRendererGetWritingDirection(this.nativeHandle);
  }

  set writingDirection(value: WritingDirection) {
    Module._TRRendererSetWritingDirection(this.nativeHandle, value);
  }

  get foregroundColor(): Color {
    return Module._TRRendererGetForegroundColor(this.nativeHandle) >>> 0;
  }

  set foregroundColor(value: Color) {
    Module._TRRendererSetForegroundColor(this.nativeHandle, value);
  }

  /** The radius of the stroke, which is half of its width. */
  get strokeRadius(): number {
    return Module._TRRendererGetStrokeRadius(this.nativeHandle);
  }

  set strokeRadius(value: number) {
    Module._TRRendererSetStrokeRadius(this.nativeHandle, value);
  }

  get strokeCap(): StrokeCap {
    return Module._TRRendererGetStrokeCap(this.nativeHandle);
  }

  set strokeCap(value: StrokeCap) {
    Module._TRRendererSetStrokeCap(this.nativeHandle, value);
  }

  get strokeJoin(): StrokeJoin {
    return Module._TRRendererGetStrokeJoin(this.nativeHandle);
  }

  set strokeJoin(value: StrokeJoin) {
    Module._TRRendererSetStrokeJoin(this.nativeHandle, value);
  }

  get strokeMiter(): number {
    return Module._TRRendererGetStrokeMiter(this.nativeHandle);
  }

  set strokeMiter(value: number) {
    Module._TRRendererSetStrokeMiter(this.nativeHandle, value);
  }

  get strokeColor(): Color {
    return Module._TRRendererGetStrokeColor(this.nativeHandle) >>> 0;
  }

  set strokeColor(value: Color) {
    Module._TRRendererSetStrokeColor(this.nativeHandle, value);
  }

  /** The blur radius of the shadow, which is drawn only if it is above zero. */
  get shadowRadius(): number {
    return Module._TRRendererGetShadowRadius(this.nativeHandle);
  }

  set shadowRadius(value: number) {
    Module._TRRendererSetShadowRadius(this.nativeHandle, value);
  }

  get shadowDx(): number {
    return Module._TRRendererGetShadowDx(this.nativeHandle);
  }

  set shadowDx(value: number) {
    Module._TRRendererSetShadowDx(this.nativeHandle, value);
  }

  get shadowDy(): number {
    return Module._TRRendererGetShadowDy(this.nativeHandle);
  }

  set shadowDy(value: number) {
    Module._TRRendererSetShadowDy(this.nativeHandle, value);
  }

  get shadowColor(): Color {
    return Module._TRRendererGetShadowColor(this.nativeHandle) >>> 0;
  }

  set shadowColor(value: Color) {
    Module._TRRendererSetShadowColor(this.nativeHandle, value);
  }

  get drawStyle(): DrawStyle {
    return Module._TRRendererGetDrawStyle(this.nativeHandle);
  }

  set drawStyle(value: DrawStyle) {
    Module._TRRendererSetDrawStyle(this.nativeHandle, value);
  }

  /** Tells whether the renderer has what it needs to render: a typeface and a positive size. */
  get isRenderable(): boolean {
    return Module._TRRendererIsRenderable(this.nativeHandle) !== 0;
  }

  /**
   * Makes the image of a glyph in the foreground color.
   *
   * @returns The image, or `undefined` if there is no typeface or the glyph has no image, such as
   *     a space.
   */
  getGlyphImage(glyphId: number): GlyphImage | undefined {
    const handle = Module._TRRendererCreateGlyphImage(this.nativeHandle, glyphId);
    return handle === 0 ? undefined : GlyphImage.adopting(handle);
  }

  /** Makes the image of the outline of a glyph, or `undefined` if there is none. */
  getStrokeImage(glyphId: number): GlyphImage | undefined {
    const handle = Module._TRRendererCreateStrokeImage(this.nativeHandle, glyphId);
    return handle === 0 ? undefined : GlyphImage.adopting(handle);
  }

  /** Makes the outline of a glyph, or `undefined` if there is none. */
  getGlyphPath(glyphId: number): Path | undefined {
    const handle = Module._TRRendererCreateGlyphPath(this.nativeHandle, glyphId);
    return handle === 0 ? undefined : Path.takeNative(handle);
  }

  /** Computes the box that the ink of a glyph covers, relative to its pen position. */
  computeGlyphInkBox(glyphId: number): Rect {
    const handle = this.nativeHandle;
    return TRRect.returning((ret) => Module._TRRendererComputeGlyphInkBox(ret, handle, glyphId));
  }

  /** Computes the box that the ink of a run of glyphs covers, relative to the start of the run. */
  computeRunInkBox(run: GlyphBuffers): Rect {
    const handle = this.nativeHandle;
    return withRun(run, (ids, offsets, advances, count) =>
      TRRect.returning((ret) => Module._TRRendererComputeRunInkBox(ret, handle, ids, offsets, advances, count)),
    );
  }

  /**
   * Finds the image of each glyph of a run, with the position to draw it at, skipping the glyphs
   * that have no image. The positions are in pixels and are rounded to whole ones. The pen starts
   * at the origin, and in a right-to-left run it moves to the left before each glyph.
   */
  getGlyphPlacements(kind: GlyphImageKind, run: GlyphBuffers): GlyphPlacement[] {
    const handle = this.nativeHandle;
    const items = withRun(run, (ids, offsets, advances, count) =>
      collect<{ glyphIndex: number; image: number; x: number; y: number; scaleX: number; scaleY: number }>((context) =>
        Module._TRRendererEnumerateGlyphPlacements(
          handle, kind, ids, offsets, advances, count, callbackPointers().placementFunc, context),
      ),
    );
    return items.map((item) => ({ ...item, image: GlyphImage.adopting(item.image) }));
  }

  /** Makes the outlines of a run of glyphs in one path, placed where the glyphs go. */
  generatePath(run: GlyphBuffers): Path {
    const handle = this.nativeHandle;
    const path = new Path();
    const key = pathSinks.add(path);
    try {
      withRun(run, (ids, offsets, advances, count) =>
        callingBack(() =>
          Module._TRRendererEnumerateGlyphPaths(
            handle, ids, offsets, advances, count, callbackPointers().pathCallbacks, key),
        ),
      );
    } finally {
      pathSinks.remove(key);
    }
    return path;
  }

  /**
   * Draws a run of glyphs with its pen at the origin of the context, as the draw style tells:
   * filled with the foreground color, stroked with the stroke color, or both.
   */
  drawGlyphs(context: DrawingContext, run: GlyphBuffers): void {
    const painter = new CanvasPainter(context, this.renderScale);
    const style = this.drawStyle;
    const passes: [GlyphImageKind, Color][] = [];
    if (style !== DrawStyle.Stroke) {
      passes.push([GlyphImageKind.Fill, this.foregroundColor]);
    }
    if (style !== DrawStyle.Fill) {
      passes.push([GlyphImageKind.Stroke, this.strokeColor]);
    }

    for (const [kind, color] of passes) {
      for (const placement of this.getGlyphPlacements(kind, run)) {
        try {
          painter.drawGlyphImage(
            placement.image.nativeHandle, placement.x, placement.y, placement.scaleX, placement.scaleY, color, undefined);
        } finally {
          placement.image.dispose();
        }
      }
    }
  }

  /**
   * Runs a call of Core that draws, with the draw callbacks of the renderer pointing to a target,
   * and takes them away afterward.
   *
   * @internal
   */
  drawWith(target: DrawTarget, draw: (renderer: number) => void): void {
        const handle = this.nativeHandle;
    const pointers = callbackPointers();
    const key = drawTargets.add(target);
    Module._TRRendererSetDrawCallbacks(
      handle, target.drawGlyphImage ? pointers.drawCallbacks : pointers.pathDrawCallbacks, key);
    try {
      callingBack(() => draw(handle));
    } finally {
      Module._TRRendererSetDrawCallbacks(handle, pointers.emptyDrawCallbacks, 0);
      drawTargets.remove(key);
    }
  }

  /**
   * Runs a call of Core that draws, and returns what it drew as SVG elements: the glyphs as
   * outlines, backgrounds and decorations as rectangles, shadows as filters.
   *
   * @internal
   */
  drawSvg(draw: (renderer: number) => void): string {
    const painter = new SvgPainter(this.renderScale, this.strokeRadius, this.strokeCap, this.strokeJoin, this.strokeMiter);
    this.drawWith(painter, draw);
    return painter.toString();
  }

  /**
   * Runs a call of Core that draws into a context.
   *
   * @internal
   */
  drawInto(context: DrawingContext, draw: (renderer: number) => void): void {
    this.drawWith(new CanvasPainter(context, this.renderScale), draw);
  }
}

function withRun<T>(
  run: GlyphBuffers,
  body: (ids: number, offsets: number, advances: number, count: number) => T,
): T {
  const count = run.glyphIds.length;
  if (run.glyphOffsets.length < count || run.glyphAdvances.length < count) {
    throw new RangeError("The offsets and the advances must have a value for each glyph.");
  }

  return withNumbers(run.glyphIds, u16, count, (ids) =>
    withPoints(run.glyphOffsets, count, (offsets) =>
      withNumbers(run.glyphAdvances, f32, count, (advances) => body(ids, offsets, advances, count)),
    ),
  );
}

// A list that reads the memory of Core is passed as it is, and anything else is copied.
function withNumbers<T>(
  source: List<number> | ArrayLike<number>,
  field: Field<number>,
  count: number,
  body: (pointer: number) => T,
): T {
  const core = coreBufferOf(source, field);
  if (core !== undefined) {
    return body(core.address);
  }
  return withValues(field, source instanceof List ? source.toArray() : source, body);
}

function withPoints<T>(source: List<Point> | ArrayLike<Point>, count: number, body: (pointer: number) => T): T {
  const core = coreBufferOf(source, pointReader);
  if (core !== undefined) {
    return body(core.address);
  }

  const points = source instanceof List ? source.toArray() : source;
  const pointer = malloc(count * TRPoint.size);
  try {
    for (let index = 0; index < count; index++) {
      TRPoint.assign(pointer + index * TRPoint.size, points[index] as Point);
    }
    return body(pointer);
  } finally {
    free(pointer);
  }
}
