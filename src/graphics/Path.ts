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

import type { AffineTransform } from "../geometry.js";
import { callingBack, callbackPointers, pathSinks } from "../internal/Callbacks.js";
import { TRAffineTransform } from "../internal/Structs.js";
import { Module } from "../internal/Module.js";
import type { PathSink } from "./PathSink.js";

/** The kinds of the segments of a path. Each one takes the number of coordinates in its comment. */
export enum PathVerb {
  /** Starts a contour at a point (2 coordinates). */
  MoveTo = 0,
  /** Draws a line to a point (2 coordinates). */
  LineTo = 1,
  /** Draws a quadratic curve through a control point to a point (4 coordinates). */
  QuadTo = 2,
  /** Draws a cubic curve through two control points to a point (6 coordinates). */
  CubicTo = 3,
  /** Closes the contour (no coordinates). */
  Close = 4,
}

const COORDINATE_COUNTS = [2, 2, 4, 6, 0] as const;

/**
 * An outline, which is a list of contours. It has no native counterpart: Core gives outlines to
 * the callbacks of a sink, and this class is a sink that keeps them.
 *
 * The y axis points downward, with the origin at the pen position of the glyph on its baseline.
 */
export class Path implements PathSink {
  #verbs: PathVerb[] = [];
  #coordinates: number[] = [];

  /** The segments of the path. */
  get verbs(): readonly PathVerb[] {
    return this.#verbs;
  }

  /** The coordinates of all segments, one after another. */
  get coordinates(): readonly number[] {
    return this.#coordinates;
  }

  get isEmpty(): boolean {
    return this.#verbs.length === 0;
  }

  moveTo(x: number, y: number): void {
    this.#verbs.push(PathVerb.MoveTo);
    this.#coordinates.push(x, y);
  }

  lineTo(x: number, y: number): void {
    this.#verbs.push(PathVerb.LineTo);
    this.#coordinates.push(x, y);
  }

  quadTo(controlX: number, controlY: number, x: number, y: number): void {
    this.#verbs.push(PathVerb.QuadTo);
    this.#coordinates.push(controlX, controlY, x, y);
  }

  cubicTo(
    control1X: number,
    control1Y: number,
    control2X: number,
    control2Y: number,
    x: number,
    y: number,
  ): void {
    this.#verbs.push(PathVerb.CubicTo);
    this.#coordinates.push(control1X, control1Y, control2X, control2Y, x, y);
  }

  close(): void {
    this.#verbs.push(PathVerb.Close);
  }

  /** Passes the segments to a sink, after moving their points by the transform if there is one. */
  enumerate(sink: PathSink, transform?: AffineTransform): void {
    const c = this.#coordinates;
    const map = (index: number): [number, number] => {
      const x = c[index] ?? 0;
      const y = c[index + 1] ?? 0;
      return transform === undefined
        ? [x, y]
        : [transform.a * x + transform.c * y + transform.tx, transform.b * x + transform.d * y + transform.ty];
    };

    let offset = 0;
    for (const verb of this.#verbs) {
      switch (verb) {
        case PathVerb.MoveTo:
          sink.moveTo(...map(offset));
          break;
        case PathVerb.LineTo:
          sink.lineTo(...map(offset));
          break;
        case PathVerb.QuadTo:
          sink.quadTo(...map(offset), ...map(offset + 2));
          break;
        case PathVerb.CubicTo:
          sink.cubicTo(...map(offset), ...map(offset + 2), ...map(offset + 4));
          break;
        case PathVerb.Close:
          sink.close();
          break;
      }
      offset += COORDINATE_COUNTS[verb];
    }
  }

  /** Makes a copy of the path with its points moved by the transform. */
  transformed(transform: AffineTransform): Path {
    const path = new Path();
    this.enumerate(path, transform);
    return path;
  }

  /** Adds the segments of another path to the end of this one. */
  append(path: Path): void {
    path.enumerate(this);
  }

  /** Formats the path as the data of the `d` attribute of an SVG `<path>`. */
  toSvgPathData(transform?: AffineTransform): string {
    const parts: string[] = [];
    this.enumerate(
      {
        moveTo: (x, y) => parts.push(`M${x} ${y}`),
        lineTo: (x, y) => parts.push(`L${x} ${y}`),
        quadTo: (cx, cy, x, y) => parts.push(`Q${cx} ${cy} ${x} ${y}`),
        cubicTo: (c1x, c1y, c2x, c2y, x, y) => parts.push(`C${c1x} ${c1y} ${c2x} ${c2y} ${x} ${y}`),
        close: () => parts.push("Z"),
      },
      transform,
    );
    return parts.join("");
  }

  /** Makes a `Path2D`, which a canvas can fill and stroke. It needs an environment that has one. */
  toPath2D(transform?: AffineTransform): Path2D {
    const path2D = new Path2D();
    this.enumerate(
      {
        moveTo: (x, y) => path2D.moveTo(x, y),
        lineTo: (x, y) => path2D.lineTo(x, y),
        quadTo: (cx, cy, x, y) => path2D.quadraticCurveTo(cx, cy, x, y),
        cubicTo: (c1x, c1y, c2x, c2y, x, y) => path2D.bezierCurveTo(c1x, c1y, c2x, c2y, x, y),
        close: () => path2D.closePath(),
      },
      transform,
    );
    return path2D;
  }

  /**
   * Copies an outline of Core to a path, and releases it.
   *
   * @internal
   */
  static takeNative(handle: number, transform?: AffineTransform): Path {
    try {
      return Path.copyNative(handle, transform);
    } finally {
      Module._TRPathRelease(handle);
    }
  }

  /**
   * Copies an outline of Core to a path, and leaves the reference as it is.
   *
   * @internal
   */
  static copyNative(handle: number, transform?: AffineTransform): Path {
    const path = new Path();
        const key = pathSinks.add(path);
    try {
      const enumerate = (transformPointer: number): boolean =>
        callingBack(() =>
          Module._TRPathEnumerate(handle, transformPointer, callbackPointers().pathCallbacks, key),
        ) !== 0;
      if (transform === undefined) {
        enumerate(0);
      } else {
        TRAffineTransform.passing(transform, enumerate);
      }
    } finally {
      pathSinks.remove(key);
    }
    return path;
  }
}
