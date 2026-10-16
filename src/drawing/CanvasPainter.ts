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

import { Color } from "../Color.js";
import type { Rect } from "../geometry.js";
import { callbackPointers, imageData, replacementKeys, replacements, type DrawTarget } from "../internal/Callbacks.js";
import { Module } from "../internal/Module.js";
import { GlyphImageFormat } from "../graphics/enums.js";
import { glyphImageToRgba } from "../graphics/GlyphImage.js";
import type { DrawingContext } from "./DrawingContext.js";
import type { ReplacementDelegate } from "./ReplacementDelegate.js";

/** Something that a context can draw with `drawImage()`, and its size. */
export interface ImageSource {
  readonly width: number;
  readonly height: number;
}

/** Makes the image that a context draws from the straight RGBA pixels of a glyph. */
export type ImageSourceFactory = (rgba: Uint8ClampedArray, width: number, height: number) => ImageSource;

const defaultFactory: ImageSourceFactory = (rgba, width, height) => {
  const canvas: HTMLCanvasElement | OffscreenCanvas =
    typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d") as DrawingContext;
  context.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);
  return canvas;
};

let factory: ImageSourceFactory = defaultFactory;

/**
 * Replaces the way that images of glyphs are made, which is for the environments that have no
 * canvas, such as the tests.
 *
 * @internal
 */
export function setImageSourceFactory(replacement: ImageSourceFactory | undefined): void {
  factory = replacement ?? defaultFactory;
}

/** The images that are made for one glyph image of Core: one for each color of an alpha image. */
class ImageCache {
  readonly #byColor = new Map<number, ImageSource>();

  get(image: number, color: Color): ImageSource {
        // A color image keeps its colors, so the color that it is asked for does not matter.
    const key = Module._TRGlyphImageGetFormat(image) === GlyphImageFormat.ARGB ? 0 : color;
    let source = this.#byColor.get(key);
    if (source === undefined) {
      const width = Module._TRGlyphImageGetWidth(image);
      const height = Module._TRGlyphImageGetHeight(image);
      source = factory(glyphImageToRgba(image, color), width, height);
      this.#byColor.set(key, source);
    }
    return source;
  }
}

/**
 * Draws what Core produces into a 2D context of a canvas: images of glyphs, filled rectangles
 * (backgrounds and decorations), replacements and shadows.
 */
export class CanvasPainter implements DrawTarget {
  readonly #context: DrawingContext;
  readonly #renderScale: number;

  constructor(context: DrawingContext, renderScale: number) {
    this.#context = context;
    this.#renderScale = renderScale;
  }

  drawGlyphImage(
    image: number,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    color: Color,
    clip: Rect | undefined,
  ): void {
        const context = this.#context;

    let key = Module._TRGlyphImageGetNativeData(image);
    let cache = key === 0 ? undefined : (imageData.get(key) as ImageCache | undefined);
    if (cache === undefined) {
      cache = new ImageCache();
      key = imageData.add(cache);
      if (Module._TRGlyphImageSetNativeData(image, key, callbackPointers().imageDestroy) === 0) {
        imageData.remove(key);
      }
    }

    const source = cache.get(image, color) as CanvasImageSource & ImageSource;
    if (clip !== undefined) {
      context.save();
      context.beginPath();
      context.rect(clip.x, clip.y, clip.width, clip.height);
      context.clip();
    }
    if (scaleX === 1 && scaleY === 1) {
      context.drawImage(source, x, y);
    } else {
      context.drawImage(source, x, y, source.width * scaleX, source.height * scaleY);
    }
    if (clip !== undefined) {
      context.restore();
    }
  }

  fillRect(rect: Rect, color: Color): void {
    this.#context.fillStyle = Color.toCss(color);
    this.#context.fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  drawReplacement(run: number, x: number, y: number): void {
        const handle = Module._TRGlyphRunGetReplacement(run);
    const key = handle === 0 ? undefined : replacementKeys.get(handle);
    const delegate = key === undefined ? undefined : (replacements.get(key)?.delegate as ReplacementDelegate | undefined);
    if (delegate?.draw === undefined) {
      return;
    }

    const scale = this.#renderScale;
    delegate.draw(this.#context, {
      x,
      y,
      ascent: Module._TRGlyphRunGetAscent(run) * scale,
      descent: Module._TRGlyphRunGetDescent(run) * scale,
      width: Module._TRGlyphRunGetWidth(run) * scale,
    });
  }

  beginShadow(radius: number, dx: number, dy: number, color: Color): void {
    const context = this.#context;
    context.save();
    context.shadowColor = Color.toCss(color);
    context.shadowBlur = radius;
    context.shadowOffsetX = dx;
    context.shadowOffsetY = dy;
  }

  endShadow(): void {
    this.#context.restore();
  }
}
