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

export { initialize, getVersion } from "./initialize.js";
export type { InitializeOptions } from "./initialize.js";

export { Color } from "./Color.js";
export { List } from "./collections/List.js";
export type { NumberList, PointList } from "./collections/List.js";
export type { Float, Int32, NumberKind, UInt16, UInt32, UInt8 } from "./collections/NumberKind.js";
export type { AffineTransform, Point, Rect, Size } from "./geometry.js";

export { SfntTag } from "./sfnt/SfntTag.js";
export { FontFeatures } from "./sfnt/FontFeatures.js";
export type { OpenTypeFeature } from "./sfnt/OpenTypeFeature.js";
export { ShapingEngine } from "./sfnt/ShapingEngine.js";
export { ShapingResult } from "./sfnt/ShapingResult.js";
export { ShapingOrder, WritingDirection } from "./sfnt/enums.js";

export { FontFile } from "./graphics/FontFile.js";
export { Typeface } from "./graphics/Typeface.js";
export { TypefaceManager } from "./graphics/TypefaceManager.js";
export { TypeFamily } from "./graphics/TypeFamily.js";
export type { BitmapStrike } from "./graphics/BitmapStrike.js";
export type { ColorPalette } from "./graphics/ColorPalette.js";
export type { NamedStyle } from "./graphics/NamedStyle.js";
export type { VariationAxis } from "./graphics/VariationAxis.js";
export { GlyphCache } from "./graphics/GlyphCache.js";
export { GlyphImage } from "./graphics/GlyphImage.js";
export { Path, PathVerb } from "./graphics/Path.js";
export type { PathSink } from "./graphics/PathSink.js";
export { Renderer } from "./graphics/Renderer.js";
export type { GlyphBuffers, GlyphPlacement } from "./graphics/Renderer.js";
export {
  DrawStyle,
  GlyphImageFormat,
  GlyphImageKind,
  StrokeCap,
  StrokeJoin,
  TypeSlope,
  TypeWeight,
  TypeWidth,
} from "./graphics/enums.js";

export type { DrawingContext } from "./drawing/DrawingContext.js";
export type { ReplacementBounds, ReplacementDelegate, ReplacementRoom } from "./drawing/ReplacementDelegate.js";

export { TText } from "./layout/TText.js";
export { TMutableText } from "./layout/TMutableText.js";
export type {
  ParagraphAttributes,
  RunAttributes,
  TextAttributeName,
  TextAttributeRun,
  TextAttributes,
} from "./layout/TextAttributes.js";
export { Replacement } from "./layout/Replacement.js";
export { Typesetter } from "./layout/Typesetter.js";
export { FrameResolver } from "./layout/FrameResolver.js";
export { ComposedFrame } from "./layout/ComposedFrame.js";
export { ComposedLine } from "./layout/ComposedLine.js";
export type { VisualEdge } from "./layout/ComposedLine.js";
export { GlyphRun } from "./layout/GlyphRun.js";
export { LineLocator } from "./layout/LineLocator.js";
export { BreakMode, ReplacementKind, TextAlignment, TruncationPlace, VerticalAlignment } from "./layout/enums.js";

export { BaseDirection } from "./unicode/BaseDirection.js";
export { BidiAlgorithm } from "./unicode/BidiAlgorithm.js";
export { BidiParagraph } from "./unicode/BidiParagraph.js";
export { BidiLine } from "./unicode/BidiLine.js";
export { BidiRun } from "./unicode/BidiRun.js";
export { BidiPair } from "./unicode/BidiPair.js";
export { ScriptClassifier } from "./unicode/ScriptClassifier.js";
export { ScriptRun } from "./unicode/ScriptRun.js";
export { CodePoint } from "./unicode/CodePoint.js";
export { BidiClass, GeneralCategory, Script } from "./unicode/enums.js";
