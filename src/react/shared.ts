import { Color } from "../Color.js";
import type { Typeface } from "../graphics/Typeface.js";
import { Renderer } from "../graphics/Renderer.js";
import { DrawStyle, StrokeCap, StrokeJoin } from "../graphics/enums.js";
import { Typesetter } from "../layout/Typesetter.js";
import type { TText } from "../layout/TText.js";

/** A color as `#rgb`, `#rrggbb` or `#aarrggbb` text (as `Color.parse()` reads it), or as an `0xAARRGGBB` number. */
export type ColorValue = string | number;

/** Where the text of a widget comes from. A typesetter wins over an attributed text, which wins over a plain string. */
export interface TextSource {
  /** Plain text, which is shown in `typeface` at `textSize`. */
  readonly text?: string;
  /** Text with attributes. `typeface` and `textSize` are used where it sets none. */
  readonly attributedText?: TText;
  /** A typesetter, which is preferred as it avoids creating one. It stays owned by the caller. */
  readonly typesetter?: Typesetter;
}

/** How text is drawn, which the widgets keep in a `Renderer`. */
export interface RenderingProps {
  /** The typeface of text that does not set one. */
  readonly typeface?: Typeface;
  /** The size of the em square, in CSS pixels. The default is 16. */
  readonly textSize?: number;
  /** The default color of text. The default is black. */
  readonly textColor?: ColorValue;
  readonly drawStyle?: DrawStyle;
  readonly strokeColor?: ColorValue;
  /** Half of the width of the stroke, in CSS pixels. */
  readonly strokeRadius?: number;
  readonly strokeCap?: StrokeCap;
  readonly strokeJoin?: StrokeJoin;
  readonly strokeMiter?: number;
  readonly shadowColor?: ColorValue;
  readonly shadowRadius?: number;
  readonly shadowDx?: number;
  readonly shadowDy?: number;
}

/** A range of code units to cover with a color, behind the text, such as a link or a selected verse. */
export interface TextHighlight {
  readonly fromIndex: number;
  readonly toIndex: number;
  /** The color of this highlight. The `highlightColor` of the widget is used when there is none. */
  readonly color?: ColorValue;
}

export const DEFAULT_TEXT_SIZE = 16;
/** The color of a highlight that has none, and of a pressed link. A translucent blue. */
export const DEFAULT_HIGHLIGHT_COLOR = 0x6633b5e5;

/** A key that tells whether two lists of highlights are the same, whatever their identities. */
export function highlightsKey(highlights: readonly TextHighlight[] | undefined): string {
  return highlights === undefined ? "" : highlights.map((h) => `${h.fromIndex}:${h.toIndex}:${h.color ?? ""}`).join("|");
}

export function toColor(value: ColorValue): Color {
  return typeof value === "number" ? value : Color.parse(value);
}

/** Makes a renderer with the settings, for a screen of the pixel ratio. */
export function createRenderer(props: RenderingProps, renderScale: number): Renderer {
  const renderer = new Renderer();
  try {
    renderer.renderScale = renderScale;
    renderer.typeSize = Math.max(0, props.textSize ?? DEFAULT_TEXT_SIZE);
    if (props.typeface !== undefined) {
      renderer.typeface = props.typeface;
    }
    if (props.textColor !== undefined) {
      renderer.foregroundColor = toColor(props.textColor);
    }
    if (props.drawStyle !== undefined) {
      renderer.drawStyle = props.drawStyle;
    }
    if (props.strokeColor !== undefined) {
      renderer.strokeColor = toColor(props.strokeColor);
    }
    if (props.strokeRadius !== undefined) {
      renderer.strokeRadius = props.strokeRadius;
    }
    if (props.strokeCap !== undefined) {
      renderer.strokeCap = props.strokeCap;
    }
    if (props.strokeJoin !== undefined) {
      renderer.strokeJoin = props.strokeJoin;
    }
    if (props.strokeMiter !== undefined) {
      renderer.strokeMiter = props.strokeMiter;
    }
    if (props.shadowColor !== undefined) {
      renderer.shadowColor = toColor(props.shadowColor);
    }
    if (props.shadowRadius !== undefined) {
      renderer.shadowRadius = props.shadowRadius;
    }
    if (props.shadowDx !== undefined) {
      renderer.shadowDx = props.shadowDx;
    }
    if (props.shadowDy !== undefined) {
      renderer.shadowDy = props.shadowDy;
    }
    return renderer;
  } catch (error) {
    renderer.dispose();
    throw error;
  }
}

/** A typesetter for a source, and whether the widget made it and so has to dispose it. */
export interface ResolvedTypesetter {
  readonly typesetter: Typesetter;
  readonly length: number;
  readonly isOwned: boolean;
}

/**
 * Finds or makes the typesetter of a source, or returns `undefined` when there is nothing to
 * show: no text, or no typeface for it.
 */
export function resolveTypesetter(
  source: TextSource, typeface: Typeface | undefined, textSize: number,
): ResolvedTypesetter | undefined {
  if (source.typesetter !== undefined) {
    return { typesetter: source.typesetter, length: source.typesetter.codeUnitCount, isOwned: false };
  }
  const attributedText = source.attributedText;
  if (attributedText !== undefined) {
    if (attributedText.length === 0) {
      return undefined;
    }
    const defaults = typeface === undefined ? { typeSize: textSize } : { typeface, typeSize: textSize };
    return { typesetter: new Typesetter(attributedText, defaults), length: attributedText.length, isOwned: true };
  }
  const text = source.text;
  if (text !== undefined && text.length > 0 && typeface !== undefined) {
    return { typesetter: new Typesetter(text, { typeface, typeSize: textSize }), length: text.length, isOwned: true };
  }
  return undefined;
}

/** Tells whether two lists of values are the same, as React does for dependencies. */
export function sameValues(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}
