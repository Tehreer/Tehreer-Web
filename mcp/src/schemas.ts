import { SfntTag, TypeSlope, TypeWeight, TypeWidth } from "@tehreer/web";
import { z } from "zod";

export const MAX_CHARACTERS = 5_000;

export const typefaceId = z.string().describe("Id of a face, as returned by font_load, font_list or font_instance (e.g. 't1').");

/** `text` or `codePoints`; `characterList()` resolves them. */
export const characterInput = {
  text: z.string().max(MAX_CHARACTERS).optional().describe("Text whose characters (code points) are used."),
  codePoints: z
    .array(z.number().int().min(0).max(0x10ffff))
    .max(MAX_CHARACTERS)
    .optional()
    .describe("Code points to use, as an alternative to text."),
};

export interface Character {
  /** UTF-16 offset in `text`, or the position in `codePoints`. */
  readonly index: number;
  readonly codePoint: number;
}

export function characterList(input: { text?: string; codePoints?: number[] }): Character[] {
  if (input.text !== undefined && input.codePoints !== undefined) {
    throw new Error("Give either text or codePoints, not both.");
  }
  if (input.codePoints) {
    return input.codePoints.map((codePoint, index) => ({ index, codePoint }));
  }
  if (input.text === undefined) {
    throw new Error("Give text or codePoints.");
  }
  const result: Character[] = [];
  for (let i = 0; i < input.text.length; ) {
    const codePoint = input.text.codePointAt(i)!;
    result.push({ index: i, codePoint });
    i += codePoint > 0xffff ? 2 : 1;
  }
  return result;
}

export const sfntTag = z
  .string()
  .min(1)
  .max(4)
  .describe("OpenType tag of up to 4 printable ASCII characters, e.g. 'wght', 'head', 'arab'.");

export function parseTag(text: string): SfntTag {
  return SfntTag.make(text);
}

export const colorString = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "Use #RRGGBB or #RRGGBBAA")
  .describe("Color as #RRGGBB or #RRGGBBAA.");

/** Parses `#RRGGBB[AA]` to `0xAARRGGBB`. */
export function parseColor(text: string): number {
  const hex = text.slice(1);
  const rgb = parseInt(hex.slice(0, 6), 16);
  const alpha = hex.length === 8 ? parseInt(hex.slice(6), 16) : 0xff;
  return ((alpha << 24) | rgb) >>> 0;
}

/** Formats `0xAARRGGBB` as `#RRGGBBAA`, or `#RRGGBB` when opaque. */
export function formatColor(color: number): string {
  const alpha = (color >>> 24) & 0xff;
  const rgb = (color & 0xffffff).toString(16).toUpperCase().padStart(6, "0");
  return "#" + rgb + (alpha === 0xff ? "" : alpha.toString(16).toUpperCase().padStart(2, "0"));
}

/** The name of a member of a numeric enum, or the number as a string when it has none. */
export function enumName(enumeration: Record<number, string>, value: number): string {
  return enumeration[value] ?? String(value);
}

/** Converts `UltraCondensed` or `ultra-condensed` to `ultra-condensed` style keys. */
function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

function enumKeys<T extends Record<string, string | number>>(enumeration: T): Record<string, number> {
  const keys: Record<string, number> = {};
  for (const [name, value] of Object.entries(enumeration)) {
    if (typeof value === "number") {
      keys[kebab(name)] = value;
    }
  }
  return keys;
}

const WEIGHTS = enumKeys(TypeWeight);
const WIDTHS = enumKeys(TypeWidth);
const SLOPES = enumKeys(TypeSlope);

export const weightInput = z
  .union([z.enum(Object.keys(WEIGHTS) as [string, ...string[]]), z.number().int().min(1).max(1000)])
  .describe("Weight name (thin, light, regular, bold, ...) or a number from 1 to 1000. Default regular.");
export const widthInput = z
  .enum(Object.keys(WIDTHS) as [string, ...string[]])
  .describe("Width name (condensed, normal, expanded, ...). Default normal.");
export const slopeInput = z.enum(Object.keys(SLOPES) as [string, ...string[]]).describe("plain, italic or oblique. Default plain.");

export const parseWeight = (value: string | number | undefined): number =>
  value === undefined ? TypeWeight.Regular : typeof value === "number" ? value : WEIGHTS[value]!;
export const parseWidth = (value: string | undefined): TypeWidth => (value === undefined ? TypeWidth.Normal : WIDTHS[value]!);
export const parseSlope = (value: string | undefined): TypeSlope => (value === undefined ? TypeSlope.Plain : SLOPES[value]!);

export const weightName = (weight: number): string => kebab(enumName(TypeWeight, weight));
export const widthName = (width: number): string => kebab(enumName(TypeWidth, width));
export const slopeName = (slope: number): string => kebab(enumName(TypeSlope, slope));
