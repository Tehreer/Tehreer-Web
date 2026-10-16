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
  forwardRef, memo, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties,
} from "react";
import { Color } from "../Color.js";
import type { Rect } from "../geometry.js";
import type { ComposedFrame } from "../layout/ComposedFrame.js";
import { FrameResolver } from "../layout/FrameResolver.js";
import { LineLocator } from "../layout/LineLocator.js";
import { TextAlignment } from "../layout/enums.js";
import type { TText } from "../layout/TText.js";
import { usePointerEvents, type CodeUnitEvents } from "./pointer.js";
import { measureVisibleRange, observeScroll, scrollContentTo } from "./scroll.js";
import { assignSlots, NO_SLOTS, type SlotAssignment } from "./slots.js";
import {
  createRenderer, DEFAULT_HIGHLIGHT_COLOR, DEFAULT_TEXT_SIZE, highlightsKey, resolveTypesetter, toColor,
  type ColorValue, type RenderingProps, type TextHighlight, type TextSource,
} from "./shared.js";

/** The properties of a `TTextView`, which are the ones of the text views of Tehreer-Android and Tehreer-Cocoa. */
export interface TTextViewProps extends TextSource, RenderingProps, CodeUnitEvents {
  /** The horizontal alignment of the text. The default is `TextAlignment.Leading`. */
  readonly textAlignment?: TextAlignment;
  /** Space added after each line, in CSS pixels. It applies before `lineHeightMultiplier`. */
  readonly extraLineSpacing?: number;
  /** A multiple of the height of each line, after `extraLineSpacing`. The default is 1. */
  readonly lineHeightMultiplier?: number;
  /** Whether to justify the lines of the text. The default is `false`. */
  readonly isJustificationEnabled?: boolean;
  /** How much of the extra space of a line is spread, from 0 to 1. The default is 1. */
  readonly justificationLevel?: number;
  /** The color of a line drawn below each line of text. There is none by default. */
  readonly separatorColor?: ColorValue;
  /** The color that covers a link while it is pressed, and the highlights that have no color. */
  readonly highlightColor?: ColorValue;
  /**
   * Ranges to cover with a color, behind the text, such as a selected verse. They are drawn again
   * when they change, without laying the text out again.
   */
  readonly highlights?: readonly TextHighlight[];
  /** Whether the runs of the attributed text that have a `userData` are links. The default is `true`. */
  readonly isLinkInteractionEnabled?: boolean;
  /**
   * Called when a link is clicked. A link is a run of the attributed text whose `userData` is not zero.
   *
   * @param userData The `userData` of the run.
   * @param fromIndex The first code unit of the run.
   * @param toIndex The index after the last code unit of the run.
   */
  readonly onLinkClick?: (userData: number, fromIndex: number, toIndex: number) => void;
  /**
   * What scrolls the text. `"self"` (the default) makes the view a scrolling box, which needs a height from
   * `style` or its container, as the text view of Android is a scroll view. `"window"` makes the view as tall as
   * its text, and the page scrolls it: only the lines in view of the window have canvases.
   */
  readonly scrollContainer?: "self" | "window";
  /** Called when the visible part of the text changes, with the distance of its top from the top of the text. */
  readonly onScroll?: (scrollTop: number) => void;
  readonly id?: string;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly lang?: string;
  readonly dir?: "ltr" | "rtl" | "auto";
  /** The text for assistive technology. It is the text of the view by default. */
  readonly "aria-label"?: string;
}

/** What a reference to a `TTextView` gives. */
export interface TTextViewHandle {
  /** The frame that is laid out for the whole text, or `undefined` when there is no text. */
  readonly composedFrame: ComposedFrame | undefined;
  /** The index of the first code unit that is visible, or `undefined` when there is no text. */
  readonly firstVisibleCodeUnitIndex: number | undefined;
  /**
   * Finds the code unit under a position of the text, in CSS pixels from its top left, where the
   * top of the text is the top of its first line, whatever is scrolled.
   *
   * @returns The index, or `undefined` if there is no character at the position.
   */
  indexOfCodeUnit(x: number, y: number): number | undefined;
  /** Scrolls the line of a code unit to the top of the view or of the window. */
  scrollToCodeUnit(index: number, smooth?: boolean): void;
  /** Returns the rectangles of code units, in the coordinates of the text. */
  getSelectionRects(fromIndex: number, toIndex: number): Rect[];
}

interface Link {
  readonly userData: number;
  readonly fromIndex: number;
  readonly toIndex: number;
}


/** Finds the runs of an attributed text that have a `userData`. */
function findLinks(text: TText | undefined): Link[] {
  const links: Link[] = [];
  if (text === undefined) {
    return links;
  }
  for (let index = 0; index < text.length; ) {
    const run = text.getAttributeRun(index);
    if (run === undefined || run.length <= 0) {
      break;
    }
    const userData = run.attributes.userData;
    if (userData !== undefined && userData !== 0) {
      // Runs next to each other with the same `userData` are one link, even if their colors differ.
      const last = links[links.length - 1];
      if (last !== undefined && last.userData === userData && last.toIndex === index) {
        links[links.length - 1] = { userData, fromIndex: last.fromIndex, toIndex: index + run.length };
      } else {
        links.push({ userData, fromIndex: index, toIndex: index + run.length });
      }
    }
    index += run.length;
  }
  return links;
}

/** What is needed to draw the lines, which changes with every layout. The wrappers are released after a moment, as a render may still read them. */
interface Layout {
  readonly id: number;
  readonly frame: ComposedFrame;
  readonly locator: LineLocator;
  readonly renderer: ReturnType<typeof createRenderer>;
  readonly scale: number;
  readonly width: number;
  readonly separator: number | undefined;
  readonly highlight: number;
  dispose(): void;
}

/** The box of a line canvas, in the coordinates of the text, in whole pixels. */
interface LineBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** What the lines in view have: the slot of each, and its box. */
interface VisibleLines extends SlotAssignment {
  readonly boxes: ReadonlyMap<number, LineBox>;
}

const NO_LINES: VisibleLines = { ...NO_SLOTS, boxes: new Map() };

/** How far beyond the viewport lines have canvases, as a share of its height. */
const OVERSCAN = 0.5;

let nextLayoutId = 1;

/**
 * The box a line needs: its own box across the whole width, which holds the separator and the
 * highlights, together with its ink box, so that nothing that it draws is cut off.
 */
function lineBoxOf(layout: Layout, index: number): LineBox {
  const line = layout.frame.lines.get(index);
  const ink = layout.locator.getLineBox(index);
  const top = line.origin.y - line.ascent;
  const left = Math.floor(Math.min(0, ink.x));
  const right = Math.ceil(Math.max(layout.width, ink.x + ink.width));
  const y = Math.floor(Math.min(top, ink.y));
  const bottom = Math.ceil(Math.max(top + line.height, ink.y + ink.height));
  return { x: left, y, width: right - left, height: bottom - y };
}

interface DrawnHighlight {
  readonly rect: Rect;
  readonly color: number;
}

/** A canvas that is reused for one line after another: it draws when its line or what is behind it changes. */
const LineCanvas = memo(function LineCanvas({ layout, lineIndex, box, highlights }: {
  layout: Layout;
  lineIndex: number | undefined;
  box: LineBox | undefined;
  highlights: readonly DrawnHighlight[];
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const element = canvas.current;
    if (element === null || lineIndex === undefined || box === undefined) {
      return;
    }
    const { frame, renderer, scale, separator } = layout;
    // Giving a canvas a size drops its pixels and its memory, so it is only done when the size differs.
    const pixelWidth = Math.max(1, Math.ceil(box.width * scale));
    const pixelHeight = Math.max(1, Math.ceil(box.height * scale));
    if (element.width !== pixelWidth || element.height !== pixelHeight) {
      element.width = pixelWidth;
      element.height = pixelHeight;
    }
    const context = element.getContext("2d")!;
    context.clearRect(0, 0, pixelWidth, pixelHeight);

    // A highlight covers only the band of this line: its rectangles can be taller than the line, and
    // what is beyond the band belongs to the neighbouring lines, which draw their own part.
    const line = frame.lines.get(lineIndex);
    const bandTop = line.origin.y - line.ascent;
    const bandBottom = bandTop + line.height;
    for (const { rect, color } of highlights) {
      const top = Math.max(rect.y, bandTop);
      const bottom = Math.min(rect.y + rect.height, bandBottom);
      if (bottom > top) {
        context.fillStyle = Color.toCss(color);
        context.fillRect((rect.x - box.x) * scale, (top - box.y) * scale, rect.width * scale, (bottom - top) * scale);
      }
    }

    if (separator !== undefined) {
      const bottom = Math.floor(bandBottom - 0.5);
      context.fillStyle = Color.toCss(separator);
      context.fillRect(-box.x * scale, (bottom - box.y) * scale, layout.width * scale, scale);
    }
    line.draw(renderer, context, -box.x, -box.y);
  }, [layout, lineIndex, box, highlights]);

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      style={{
        position: "absolute",
        display: box === undefined ? "none" : "block",
        left: box?.x ?? 0,
        top: box?.y ?? 0,
        width: box?.width ?? 0,
        height: box?.height ?? 0,
        pointerEvents: "none",
      }}
    />
  );
});

/**
 * A view of long text, drawn with Tehreer. The text is laid out for the width of the view, and
 * every line in view has a canvas of its own, as big as what the line draws. Those canvases are
 * reused as lines scroll in and out of view, so there are only as many as fit the screen, and
 * scrolling draws nothing but the lines that come into view. A change of width keeps the first
 * visible line in place.
 */
export const TTextView = forwardRef<TTextViewHandle, TTextViewProps>(function TTextView(props, ref) {
  const {
    text, attributedText, typesetter, typeface, textSize = DEFAULT_TEXT_SIZE, textAlignment, extraLineSpacing,
    lineHeightMultiplier, isJustificationEnabled, justificationLevel, separatorColor, highlightColor, highlights,
    onHoverChange, onPressChange, onTap, isLinkInteractionEnabled = true, onLinkClick, scrollContainer = "self",
    onScroll, id, className, style, lang, dir,
    textColor, drawStyle, strokeColor, strokeRadius, strokeCap, strokeJoin, strokeMiter,
    shadowColor, shadowRadius, shadowDx, shadowDy,
  } = props;

  const isWindow = scrollContainer === "window";
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<Layout | undefined>();
  const layoutRef = useRef<Layout | undefined>(undefined);
  layoutRef.current = layout;
  const anchorRef = useRef<{ codeUnitIndex: number; viewportY: number } | undefined>(undefined);
  const [width, setWidth] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [lines, setLines] = useState<VisibleLines>(NO_LINES);
  const [pressedLink, setPressedLink] = useState<Link | undefined>();
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;

  const links = useMemo(() => findLinks(attributedText), [attributedText]);
  const scroller = () => (isWindow ? null : root.current);

  useLayoutEffect(() => {
    const element = root.current;
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

  /** Finds the lines that are in view, or near it, and gives each a canvas. */
  const updateVisibleLines = (current: Layout | undefined) => {
    const element = content.current;
    if (current === undefined || element === null || current.frame.lines.length === 0) {
      setLines((previous) => (previous === NO_LINES || previous.slots.size === 0 ? previous : { ...NO_SLOTS, boxes: new Map() }));
      return;
    }
    const range = measureVisibleRange(element, scroller());
    onScrollRef.current?.(range.top);
    const margin = (range.bottom - range.top) * OVERSCAN;
    const indices = current.locator.findLines({
      x: 0, y: range.top - margin, width: current.width, height: range.bottom - range.top + margin * 2,
    });
    setLines((previous) => {
      const assignment = assignSlots(previous, indices);
      if (assignment === previous) {
        return previous;
      }
      const boxes = new Map<number, LineBox>();
      for (const index of indices) {
        boxes.set(index, previous.boxes.get(index) ?? lineBoxOf(current, index));
      }
      return { ...assignment, boxes };
    });
  };

  // The first line in view, and where it is on the screen, to keep it there when the text lays out again.
  const rememberAnchor = (previous: Layout | undefined) => {
    const element = content.current;
    if (previous === undefined || element === null || previous.frame.lines.length === 0) {
      return;
    }
    const range = measureVisibleRange(element, scroller());
    const line = previous.frame.lines.get(previous.frame.getLineIndexAtPosition(0, range.top));
    const top = line.origin.y - line.ascent;
    anchorRef.current = { codeUnitIndex: line.startIndex, viewportY: top - range.top };
  };

  useLayoutEffect(() => {
    // With no width there is nothing to lay out, and the layout of the last effect is released as this one starts,
    // so it must not stay in the state, where a render would read a frame that is gone.
    if (width <= 0) {
      setLines(NO_LINES);
      setLayout(undefined);
      setContentHeight(0);
      return undefined;
    }
    rememberAnchor(layoutRef.current);

    const scale = window.devicePixelRatio || 1;
    const resolved = resolveTypesetter({ text, attributedText, typesetter }, typeface, textSize);
    if (resolved === undefined) {
      setLayout(undefined);
      setContentHeight(0);
      return undefined;
    }

    const renderer = createRenderer({
      typeface, textSize, textColor, drawStyle, strokeColor, strokeRadius, strokeCap, strokeJoin, strokeMiter,
      shadowColor, shadowRadius, shadowDx, shadowDy,
    }, scale);
    const resolver = new FrameResolver();
    let frame: ComposedFrame | undefined;
    let locator: LineLocator | undefined;
    try {
      resolver.typesetter = resolved.typesetter;
      resolver.frameWidth = width;
      resolver.frameHeight = 1e7;
      resolver.fitsVertically = true;
      resolver.textAlignment = textAlignment ?? TextAlignment.Leading;
      resolver.extraLineSpacing = extraLineSpacing ?? 0;
      resolver.lineHeightMultiplier = lineHeightMultiplier ?? 1;
      resolver.isJustificationEnabled = isJustificationEnabled ?? false;
      resolver.justificationLevel = justificationLevel ?? 1;
      frame = resolver.createFrame(0, resolved.length);
      locator = new LineLocator(frame, renderer);
    } catch (error) {
      locator?.dispose();
      frame?.dispose();
      renderer.dispose();
      throw error;
    } finally {
      resolver.dispose();
      if (resolved.isOwned) {
        resolved.typesetter.dispose();
      }
    }

    const made = frame;
    const madeLocator = locator;
    const created: Layout = {
      id: nextLayoutId++,
      frame: made, locator: madeLocator, renderer, scale, width,
      separator: separatorColor === undefined ? undefined : toColor(separatorColor),
      highlight: highlightColor === undefined ? DEFAULT_HIGHLIGHT_COLOR : toColor(highlightColor),
      dispose() {
        madeLocator.dispose();
        made.dispose();
        renderer.dispose();
      },
    };
    setLines(NO_LINES);
    setLayout(created);
    setContentHeight(Math.ceil(made.height));

    // A render that is under way may still read the layout, so it is released a moment later.
    return () => {
      setTimeout(() => created.dispose(), 100);
    };
  }, [
    width, text, attributedText, typesetter, typeface, textSize, textAlignment, extraLineSpacing, lineHeightMultiplier,
    isJustificationEnabled, justificationLevel, separatorColor, highlightColor, textColor, drawStyle, strokeColor,
    strokeRadius, strokeCap, strokeJoin, strokeMiter, shadowColor, shadowRadius, shadowDx, shadowDy,
  ]);

  // Once the text has its new height: put the line that was at the top back, and give the lines in view canvases.
  useLayoutEffect(() => {
    const element = content.current;
    if (layout === undefined || element === null) {
      return undefined;
    }
    const anchor = anchorRef.current;
    anchorRef.current = undefined;
    if (anchor !== undefined) {
      const lineIndex = layout.frame.getLineIndexForCodeUnit(anchor.codeUnitIndex);
      if (lineIndex >= 0) {
        const line = layout.frame.lines.get(lineIndex);
        const top = line.origin.y - line.ascent;
        const range = measureVisibleRange(element, scroller());
        const shift = top - anchor.viewportY - range.top;
        if (shift !== 0) {
          const box = scroller();
          if (box === null) {
            window.scrollBy(0, shift);
          } else {
            box.scrollTop += shift;
          }
        }
      }
    }
    updateVisibleLines(layout);
    return observeScroll(scroller(), () => {
      updateVisibleLines(layout);
      cancelPress();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, contentHeight, isWindow]);

  const indexAt = (x: number, y: number): number | undefined => {
    const current = layoutRef.current;
    if (current === undefined || current.frame.lines.length === 0) {
      return undefined;
    }
    const line = current.frame.lines.get(current.frame.getLineIndexAtPosition(x, y));
    if (x < line.origin.x || x > line.origin.x + line.width) {
      return undefined;
    }
    return Math.min(line.getCodeUnitIndexAtDistance(x - line.origin.x), line.endIndex - 1);
  };

  useImperativeHandle(ref, () => ({
    get composedFrame() {
      return layoutRef.current?.frame;
    },
    get firstVisibleCodeUnitIndex() {
      const current = layoutRef.current;
      const element = content.current;
      if (current === undefined || element === null || current.frame.lines.length === 0) {
        return undefined;
      }
      const range = measureVisibleRange(element, scroller());
      return current.frame.lines.get(current.frame.getLineIndexAtPosition(0, range.top)).startIndex;
    },
    indexOfCodeUnit: indexAt,
    scrollToCodeUnit(index: number, smooth = false) {
      const current = layoutRef.current;
      const element = content.current;
      if (current === undefined || element === null) {
        return;
      }
      const lineIndex = current.frame.getLineIndexForCodeUnit(index);
      if (lineIndex >= 0) {
        const line = current.frame.lines.get(lineIndex);
        scrollContentTo(element, line.origin.y - line.ascent, scroller(), smooth);
      }
    },
    getSelectionRects(fromIndex: number, toIndex: number) {
      return layoutRef.current?.frame.getSelectionRects(fromIndex, toIndex) ?? [];
    },
  }));

  // The links of the text are pressed and clicked through the same events that the owner gets.
  const linkAt = (index: number | undefined) =>
    !isLinkInteractionEnabled || index === undefined ? undefined : links.find((l) => index >= l.fromIndex && index < l.toIndex);

  const { handlers: pointer, cancelPress } = usePointerEvents({
    hitTest(clientX, clientY) {
      const box = content.current?.getBoundingClientRect();
      return box === undefined ? undefined : indexAt(clientX - box.left, clientY - box.top);
    },
    getScroll: () => Math.round(content.current?.getBoundingClientRect().top ?? 0),
  }, {
    onHoverChange,
    onPressChange(index) {
      setPressedLink(linkAt(index));
      onPressChange?.(index);
    },
    onTap(index) {
      const link = linkAt(index);
      if (link !== undefined) {
        onLinkClick?.(link.userData, link.fromIndex, link.toIndex);
      }
      onTap?.(index);
    },
  });

  // What is behind the lines: the highlights and the pressed link, as rectangles that the canvases pick from.
  const highlightKey = highlightsKey(highlights);
  const drawn = useMemo<readonly DrawnHighlight[]>(() => {
    if (layout === undefined) {
      return [];
    }
    const covered: TextHighlight[] = [...(highlights ?? [])];
    if (pressedLink !== undefined) {
      covered.push(pressedLink);
    }
    const rects: DrawnHighlight[] = [];
    for (const range of covered) {
      const color = range.color === undefined ? layout.highlight : toColor(range.color);
      for (const rect of layout.frame.getSelectionRects(range.fromIndex, range.toIndex)) {
        rects.push({ rect, color });
      }
    }
    return rects;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout, highlightKey, pressedLink]);

  // Every canvas of the pool is rendered, so the elements are kept; the ones that have no line are hidden.
  const lineOfSlot = new Map<number, number>();
  for (const [line, slot] of lines.slots) {
    lineOfSlot.set(slot, line);
  }
  const canvases = [];
  if (layout !== undefined) {
    for (let slot = 0; slot < lines.slotCount; slot++) {
      const line = lineOfSlot.get(slot);
      canvases.push(
        <LineCanvas
          key={slot}
          layout={layout}
          lineIndex={line}
          box={line === undefined ? undefined : lines.boxes.get(line)}
          highlights={drawn}
        />,
      );
    }
  }

  const label = props["aria-label"] ?? text ?? attributedText?.string;

  return (
    <div
      id={id}
      ref={root}
      className={className}
      lang={lang}
      dir={dir}
      role="document"
      aria-label={label}
      tabIndex={isWindow ? undefined : 0}
      style={{
        position: "relative", minWidth: 0, overflowAnchor: "none",
        ...(isWindow ? {} : { overflowY: "auto", overflowX: "hidden" }),
        ...style,
      }}
      {...pointer}
    >
      <div ref={content} style={{ position: "relative", height: contentHeight, overflow: "hidden" }}>
        {canvases}
      </div>
    </div>
  );
});
