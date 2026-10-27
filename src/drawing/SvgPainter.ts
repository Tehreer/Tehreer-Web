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
import { DrawStyle, StrokeCap, StrokeJoin } from "../graphics/enums.js";
import { Path } from "../graphics/Path.js";
import type { DrawTarget } from "../internal/Callbacks.js";

let counter = 0;

function number(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function paint(attribute: "fill" | "stroke", color: Color): string {
  const rgb = (color & 0xffffff).toString(16).padStart(6, "0");
  const alpha = Color.alpha(color);
  return `${attribute}="#${rgb}"` + (alpha === 255 ? "" : ` ${attribute}-opacity="${number(alpha / 255)}"`);
}

const CAPS = { [StrokeCap.Butt]: "butt", [StrokeCap.Round]: "round", [StrokeCap.Square]: "square" } as const;
const JOINS = { [StrokeJoin.Round]: "round", [StrokeJoin.Bevel]: "bevel", [StrokeJoin.MiterVariable]: "miter", [StrokeJoin.MiterFixed]: "miter" } as const;

/**
 * Collects what Core draws as SVG elements. Glyphs arrive as outlines, because the target has no
 * way to take images.
 */
export class SvgPainter implements DrawTarget {
  readonly #strokeWidth: string;
  readonly #strokeCap: string;
  readonly #strokeJoin: string;
  readonly #strokeMiter: string;
  readonly #definitions: string[] = [];
  readonly #body: string[] = [];

  constructor(renderScale: number, strokeRadius: number, strokeCap: StrokeCap, strokeJoin: StrokeJoin, strokeMiter: number) {
    this.#strokeWidth = number(strokeRadius * 2 * renderScale);
    this.#strokeCap = CAPS[strokeCap] ?? "round";
    this.#strokeJoin = JOINS[strokeJoin] ?? "round";
    this.#strokeMiter = number(strokeMiter);
  }

  drawGlyphPath(path: number, x: number, y: number, style: number, color: Color, clip: Rect | undefined): void {
    const data = Path.copyNative(path).toSvgPathData();
    if (data === "") {
      return;
    }
    const attributes =
      style === DrawStyle.Stroke
        ? `fill="none" ${paint("stroke", color)} stroke-width="${this.#strokeWidth}" stroke-linecap="${this.#strokeCap}" ` +
          `stroke-linejoin="${this.#strokeJoin}" stroke-miterlimit="${this.#strokeMiter}"`
        : paint("fill", color);
    const element = `<path d="${data}" transform="translate(${number(x)} ${number(y)})" ${attributes}/>`;
    if (clip === undefined) {
      this.#body.push(element);
      return;
    }
    const id = `tehreer-clip-${++counter}`;
    this.#definitions.push(
      `<clipPath id="${id}"><rect x="${number(clip.x)}" y="${number(clip.y)}" width="${number(clip.width)}" height="${number(clip.height)}"/></clipPath>`,
    );
    this.#body.push(`<g clip-path="url(#${id})">${element}</g>`);
  }

  fillRect(rect: Rect, color: Color): void {
    this.#body.push(
      `<rect x="${number(rect.x)}" y="${number(rect.y)}" width="${number(rect.width)}" height="${number(rect.height)}" ${paint("fill", color)}/>`,
    );
  }

  drawReplacement(): void {
    // A replacement is drawn by its delegate into a canvas, which an SVG does not have.
  }

  beginShadow(radius: number, dx: number, dy: number, color: Color): void {
    const id = `tehreer-shadow-${++counter}`;
    const rgb = (color & 0xffffff).toString(16).padStart(6, "0");
    this.#definitions.push(
      `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">` +
        `<feDropShadow dx="${number(dx)}" dy="${number(dy)}" stdDeviation="${number(radius / 2)}" ` +
        `flood-color="#${rgb}" flood-opacity="${number(Color.alpha(color) / 255)}"/></filter>`,
    );
    this.#body.push(`<g filter="url(#${id})">`);
  }

  endShadow(): void {
    this.#body.push("</g>");
  }

  toString(): string {
    const definitions = this.#definitions.length === 0 ? "" : `<defs>${this.#definitions.join("")}</defs>`;
    return `<g>${definitions}${this.#body.join("")}</g>`;
  }
}
