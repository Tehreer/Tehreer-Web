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

import {
  forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, useState, type CSSProperties,
} from "react";
import type { ComposedFrame } from "../layout/ComposedFrame.js";
import type { Renderer } from "../graphics/Renderer.js";
import { FrameResolver } from "../layout/FrameResolver.js";
import { BreakMode, TextAlignment, TruncationPlace, VerticalAlignment } from "../layout/enums.js";
import { Color } from "../Color.js";
import type { Rect } from "../geometry.js";
import { usePointerEvents, type CodeUnitEvents } from "./pointer.js";
import {
  createRenderer, DEFAULT_HIGHLIGHT_COLOR, DEFAULT_TEXT_SIZE, highlightsKey, resolveTypesetter, toColor,
  type ColorValue, type RenderingProps, type TextHighlight, type TextSource,
} from "./shared.js";

/** The properties of a `TLabel`, which are the ones of the labels of Tehreer-Android and Tehreer-Cocoa. */
export interface TLabelProps extends TextSource, RenderingProps, CodeUnitEvents {
  /** The horizontal alignment of the text. The default is `TextAlignment.Leading`. */
  readonly textAlignment?: TextAlignment;
  /** Where the text sits when the label is taller than it. Needs `height`. The default is `VerticalAlignment.Top`. */
  readonly verticalAlignment?: VerticalAlignment;
  /** How the last line is truncated in case of overflow. The default is `BreakMode.Line`. */
  readonly truncationMode?: BreakMode;
  /** Where the last line is truncated. It takes effect when `isTruncationEnabled` is set. */
  readonly truncationPlace?: TruncationPlace;
  /** Whether to truncate the last line in case of overflow. The default is `false`. */
  readonly isTruncationEnabled?: boolean;
  /** The most lines to show. The default is no limit. */
  readonly maxLines?: number;
  /** Space added after each line, in CSS pixels. It applies before `lineHeightMultiplier`. */
  readonly extraLineSpacing?: number;
  /** A multiple of the height of each line, after `extraLineSpacing`. The default is 1. */
  readonly lineHeightMultiplier?: number;
  /** A height in CSS pixels. The label is as tall as its text when there is none. */
  readonly height?: number;
  /**
   * Ranges to cover with a color, behind the text. They are drawn again when they change, without
   * laying the text out again.
   */
  readonly highlights?: readonly TextHighlight[];
  /** The color of a highlight that has none. The default is a translucent blue. */
  readonly highlightColor?: ColorValue;
  readonly id?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly lang?: string;
  readonly dir?: "ltr" | "rtl" | "auto";
  /** The text for assistive technology. It is the text of the label by default. */
  readonly "aria-label"?: string;
}

/** What a reference to a `TLabel` gives. */
export interface TLabelHandle {
  /** The frame that is shown, or `undefined` when there is no text. It is released when the label lays out again. */
  readonly composedFrame: ComposedFrame | undefined;
  /**
   * Finds the code unit under a position of the label, in CSS pixels from its top left.
   *
   * @returns The index, or `undefined` if there is no character at the position.
   */
  indexOfCodeUnit(x: number, y: number): number | undefined;
  /** Returns the rectangles of code units, in the coordinates of the label. */
  getSelectionRects(fromIndex: number, toIndex: number): Rect[];
}

/**
 * A label that draws text with Tehreer. It is as wide as its container and as tall as its text
 * unless `height` is given, and it lays out again when its container or any property changes.
 */
export const TLabel = forwardRef<TLabelHandle, TLabelProps>(function TLabel(props, ref) {
  const {
    text, attributedText, typesetter, typeface, textSize = DEFAULT_TEXT_SIZE, textAlignment, verticalAlignment,
    truncationMode, truncationPlace, isTruncationEnabled, maxLines, extraLineSpacing, lineHeightMultiplier,
    height, highlights, highlightColor, onHoverChange, onPressChange, onTap, id, className, style, lang, dir,
    textColor, drawStyle, strokeColor, strokeRadius, strokeCap, strokeJoin, strokeMiter,
    shadowColor, shadowRadius, shadowDx, shadowDy,
  } = props;

  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<ComposedFrame | undefined>(undefined);
  const rendererRef = useRef<Renderer | undefined>(undefined);
  const highlightsRef = useRef({ highlights, color: highlightColor });
  highlightsRef.current = { highlights, color: highlightColor };
  const [width, setWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  useLayoutEffect(() => {
    const element = wrapper.current;
    if (element === null) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry !== undefined) {
        setWidth(Math.floor(entry.contentRect.width));
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /** Draws the frame, with the highlights behind it. */
  const paint = useCallback(() => {
    const element = canvas.current;
    const frame = frameRef.current;
    const renderer = rendererRef.current;
    if (element === null || frame === undefined || renderer === undefined) {
      return;
    }
    const context = element.getContext("2d")!;
    const scale = renderer.renderScale;
    context.clearRect(0, 0, element.width, element.height);
    const { highlights: ranges, color } = highlightsRef.current;
    for (const range of ranges ?? []) {
      context.fillStyle = Color.toCss(toColor(range.color ?? color ?? DEFAULT_HIGHLIGHT_COLOR));
      for (const rect of frame.getSelectionRects(range.fromIndex, range.toIndex)) {
        context.fillRect(rect.x * scale, rect.y * scale, rect.width * scale, rect.height * scale);
      }
    }
    frame.draw(renderer, context, 0, 0);
  }, []);

  useLayoutEffect(() => {
    const element = canvas.current;
    if (element === null || width <= 0) {
      return undefined;
    }
    const scale = window.devicePixelRatio || 1;
    const resolved = resolveTypesetter({ text, attributedText, typesetter }, typeface, textSize);
    if (resolved === undefined) {
      frameRef.current = undefined;
      rendererRef.current = undefined;
      element.width = 1;
      element.height = 1;
      setContentHeight(0);
      return undefined;
    }

    const renderer = createRenderer({
      typeface, textSize, textColor, drawStyle, strokeColor, strokeRadius, strokeCap, strokeJoin, strokeMiter,
      shadowColor, shadowRadius, shadowDx, shadowDy,
    }, scale);
    const resolver = new FrameResolver();
    let frame: ComposedFrame | undefined;
    try {
      resolver.typesetter = resolved.typesetter;
      resolver.frameWidth = width;
      resolver.frameHeight = height ?? 1e6;
      resolver.fitsVertically = height === undefined;
      resolver.textAlignment = textAlignment ?? TextAlignment.Leading;
      resolver.verticalAlignment = verticalAlignment ?? VerticalAlignment.Top;
      resolver.truncationMode = truncationMode ?? BreakMode.Line;
      resolver.truncationPlace = truncationPlace ?? TruncationPlace.End;
      resolver.isTruncationEnabled = isTruncationEnabled ?? false;
      resolver.maxLines = maxLines;
      resolver.extraLineSpacing = extraLineSpacing ?? 0;
      resolver.lineHeightMultiplier = lineHeightMultiplier ?? 1;
      frame = resolver.createFrame(0, resolved.length);

      const cssHeight = height ?? Math.ceil(frame.height);
      element.width = Math.max(1, Math.ceil(width * scale));
      element.height = Math.max(1, Math.ceil(cssHeight * scale));
      frameRef.current = frame;
      rendererRef.current = renderer;
      paint();
      setContentHeight(cssHeight);
    } catch (error) {
      frame?.dispose();
      renderer.dispose();
      frameRef.current = undefined;
      rendererRef.current = undefined;
      throw error;
    } finally {
      resolver.dispose();
      if (resolved.isOwned) {
        resolved.typesetter.dispose();
      }
    }

    return () => {
      if (frameRef.current === frame) {
        frameRef.current = undefined;
        rendererRef.current = undefined;
      }
      frame?.dispose();
      renderer.dispose();
    };
  }, [
    width, text, attributedText, typesetter, typeface, textSize, textAlignment, verticalAlignment, truncationMode,
    truncationPlace, isTruncationEnabled, maxLines, extraLineSpacing, lineHeightMultiplier, height, textColor,
    drawStyle, strokeColor, strokeRadius, strokeCap, strokeJoin, strokeMiter, shadowColor, shadowRadius, shadowDx,
    shadowDy, paint,
  ]);

  // The highlights change often, such as with the pointer, so they only paint.
  const highlightKey = highlightsKey(highlights);
  useLayoutEffect(() => paint(), [highlightKey, highlightColor, paint]);

  const indexOfCodeUnit = (x: number, y: number): number | undefined => {
    const frame = frameRef.current;
    if (frame === undefined || frame.lines.length === 0) {
      return undefined;
    }
    const line = frame.lines.get(frame.getLineIndexAtPosition(x, y));
    const lineLeft = line.origin.x;
    if (x < lineLeft || x > lineLeft + line.width) {
      return undefined;
    }
    return Math.min(line.getCodeUnitIndexAtDistance(x - lineLeft), line.endIndex - 1);
  };

  useImperativeHandle(ref, () => ({
    get composedFrame() {
      return frameRef.current;
    },
    indexOfCodeUnit,
    getSelectionRects: (fromIndex: number, toIndex: number) =>
      frameRef.current?.getSelectionRects(fromIndex, toIndex) ?? [],
  }));

  const { handlers: pointer } = usePointerEvents({
    hitTest(clientX, clientY) {
      const box = canvas.current?.getBoundingClientRect();
      return box === undefined ? undefined : indexOfCodeUnit(clientX - box.left, clientY - box.top);
    },
  }, { onHoverChange, onPressChange, onTap });

  const label = props["aria-label"] ?? text ?? attributedText?.string;

  return (
    <div id={id} ref={wrapper} className={className} style={{ minWidth: 0, overflow: "hidden", ...style }} {...pointer}>
      <canvas
        ref={canvas}
        role="img"
        aria-label={label}
        lang={lang}
        dir={dir}
        style={{ display: "block", width: width > 0 ? `${width}px` : "100%", height: `${contentHeight}px` }}
      />
    </div>
  );
});
