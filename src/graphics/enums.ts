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

/** The thickness of a typeface on the scale of the CSS and OpenType weight classes. */
export enum TypeWeight {
  Thin = 100,
  ExtraLight = 200,
  Light = 300,
  Regular = 400,
  Medium = 500,
  SemiBold = 600,
  Bold = 700,
  ExtraBold = 800,
  ExtraHeavy = 900,
}

/** How condensed or expanded a typeface is, on the scale of the OpenType width classes. */
export enum TypeWidth {
  UltraCondensed = 1,
  ExtraCondensed = 2,
  Condensed = 3,
  SemiCondensed = 4,
  Normal = 5,
  SemiExpanded = 6,
  Expanded = 7,
  ExtraExpanded = 8,
  UltraExpanded = 9,
}

/** Whether a typeface is upright, italic or oblique. */
export enum TypeSlope {
  Plain = 0,
  Italic = 1,
  Oblique = 2,
}

/** What the draw functions produce for glyphs. */
export enum DrawStyle {
  /** The glyphs are filled with the foreground color. */
  Fill = 0,
  /** The outlines are drawn with the stroke color. */
  Stroke = 1,
  /** The glyphs are filled, and then their outlines are drawn. */
  FillStroke = 2,
}

/** The shape at the end of an open stroked contour. */
export enum StrokeCap {
  Butt = 0,
  Round = 1,
  Square = 2,
}

/** The shape at the corner of a stroked contour. */
export enum StrokeJoin {
  Round = 0,
  Bevel = 1,
  /** A miter, which is cut at the miter limit of the renderer, as a variable length. */
  MiterVariable = 2,
  /** A miter that is cut at a fixed length. */
  MiterFixed = 3,
}

/** The pixel format of a glyph image. */
export enum GlyphImageFormat {
  /** One byte per pixel, which is the coverage of the glyph. */
  Alpha = 0,
  /** Four bytes per pixel in the order alpha, red, green, blue, premultiplied by alpha. */
  ARGB = 1,
}

/** Which kind of image of a glyph a renderer makes. */
export enum GlyphImageKind {
  Fill = 0,
  Stroke = 1,
}
