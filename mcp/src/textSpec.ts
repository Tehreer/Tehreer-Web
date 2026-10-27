import {
  Replacement,
  ReplacementKind,
  ShapingEngine,
  TextAlignment,
  TMutableText,
  Typesetter,
  type TextAttributes,
} from "tehreer";
import { z } from "zod";
import { getTypeface } from "./registry.js";
import { colorString, parseColor, parseTag, sfntTag, typefaceId } from "./schemas.js";

interface Disposable {
  dispose(): void;
}

export const MAX_LAYOUT_CHARACTERS = 20_000;

export const TEXT_ALIGNMENTS = ["left", "center", "right", "leading", "trailing"] as const;

/** The attributes of a run or a paragraph, as JSON. A missing member is not set. */
export const attributesShape = {
  typefaceId: typefaceId.optional(),
  typeSize: z.number().positive().optional().describe("Size of the em square."),
  scaleX: z.number().positive().optional(),
  scaleY: z.number().positive().optional(),
  baselineOffset: z.number().optional().describe("Moves the baseline up; negative moves it down."),
  obliqueness: z.number().optional().describe("Horizontal shear as a ratio of shift to height (synthetic italic)."),
  foregroundColor: colorString.optional(),
  backgroundColor: colorString.optional(),
  underline: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
  decorationColor: colorString.optional(),
  userData: z.number().int().optional().describe("An integer token that glyph runs report back."),
  language: z.string().optional().describe("BCP 47 language of the run, e.g. 'ur'."),
  fontFeatures: z
    .array(z.object({ tag: sfntTag, value: z.number().int().min(0).default(1) }))
    .max(64)
    .optional()
    .describe("OpenType features, e.g. [{tag:'liga',value:0}]."),
  replacement: z
    .object({
      kind: z.enum(["inline", "block"]).default("inline"),
      extent: z.number().min(0).optional().describe("Width along the line. Omit on a block to take the whole layout width."),
      ascent: z.number().min(0).default(0),
      descent: z.number().min(0).default(0),
    })
    .optional()
    .describe("Replaces the characters of the run with an empty box of this size (nothing is drawn for it)."),
  textAlignment: z.enum(TEXT_ALIGNMENTS).optional().describe("Paragraph alignment."),
  firstLineHeadIndent: z.number().optional(),
  headIndent: z.number().optional(),
  tailIndent: z.number().optional(),
  firstIndentLineCount: z.number().int().min(0).optional(),
  paragraphSpacingBefore: z.number().optional(),
  paragraphSpacing: z.number().optional(),
  lineHeightMultiple: z.number().optional(),
  minimumLineHeight: z.number().optional(),
  maximumLineHeight: z.number().optional(),
  lineSpacing: z.number().optional(),
};
const attributesObject = z.object(attributesShape);
export type JsonAttributes = z.infer<typeof attributesObject>;

/** The text to lay out, with its attributes. */
export const textSpecShape = {
  text: z.string().min(1).max(MAX_LAYOUT_CHARACTERS).describe("The text, in logical order. Indices everywhere are UTF-16 offsets."),
  defaults: attributesObject.describe(
    "Attributes of the whole text. typefaceId is required here unless every span sets one.",
  ),
  spans: z
    .array(
      z.object({
        fromIndex: z.number().int().min(0),
        toIndex: z.number().int().min(0),
        attributes: attributesObject,
      }),
    )
    .max(500)
    .optional()
    .describe("Attributes for ranges of the text; later spans override earlier ones and the defaults."),
};

export interface TextSpec {
  text: string;
  defaults: JsonAttributes;
  spans?: { fromIndex: number; toIndex: number; attributes: JsonAttributes }[];
}

const ALIGNMENTS: Record<(typeof TEXT_ALIGNMENTS)[number], TextAlignment> = {
  left: TextAlignment.Left,
  center: TextAlignment.Center,
  right: TextAlignment.Right,
  leading: TextAlignment.Leading,
  trailing: TextAlignment.Trailing,
};
export const parseAlignment = (name: (typeof TEXT_ALIGNMENTS)[number]): TextAlignment => ALIGNMENTS[name];

/** Owns the native objects made for one tool call, and releases them together. */
export class Scope {
  readonly #items: Disposable[] = [];

  add<T extends Disposable>(item: T): T {
    this.#items.push(item);
    return item;
  }

  dispose(): void {
    for (const item of this.#items.reverse()) {
      item.dispose();
    }
    this.#items.length = 0;
  }
}

function convertAttributes(attributes: JsonAttributes, scope: Scope): TextAttributes {
  const { typefaceId: face, language, fontFeatures, replacement, textAlignment, foregroundColor, backgroundColor, decorationColor, ...rest } =
    attributes;
  const result: Record<string, unknown> = { ...rest };
  if (face !== undefined) result.typeface = getTypeface(face);
  if (language !== undefined) result.languageTag = ShapingEngine.getLanguageTag(language);
  if (fontFeatures !== undefined) result.fontFeatures = fontFeatures.map((f) => ({ tag: parseTag(f.tag), value: f.value }));
  if (textAlignment !== undefined) result.textAlignment = ALIGNMENTS[textAlignment];
  if (foregroundColor !== undefined) result.foregroundColor = parseColor(foregroundColor);
  if (backgroundColor !== undefined) result.backgroundColor = parseColor(backgroundColor);
  if (decorationColor !== undefined) result.decorationColor = parseColor(decorationColor);
  if (replacement !== undefined) {
    const { kind, extent, ascent, descent } = replacement;
    result.replacement = scope.add(
      new Replacement(
        { computeRoom: (layoutWidth) => ({ ascent, descent, extent: extent ?? (kind === "block" ? layoutWidth : 0) }) },
        kind === "block" ? ReplacementKind.Block : ReplacementKind.Inline,
      ),
    );
  }
  return result as TextAttributes;
}

const hasMembers = (value: object): boolean => Object.keys(value).length > 0;

/** Builds the attributed text and its typesetter. Everything made is added to the scope. */
export function buildTypesetter(spec: TextSpec, scope: Scope): { text: TMutableText; typesetter: Typesetter } {
  const text = scope.add(new TMutableText(spec.text));
  const defaults = convertAttributes(spec.defaults, scope);
  if (hasMembers(defaults)) {
    text.setAttributes(0, spec.text.length, defaults);
  }
  for (const span of spec.spans ?? []) {
    if (span.fromIndex >= span.toIndex || span.toIndex > spec.text.length) {
      throw new RangeError(`Invalid span ${span.fromIndex}..${span.toIndex} for a text of ${spec.text.length} code units.`);
    }
    text.setAttributes(span.fromIndex, span.toIndex, convertAttributes(span.attributes, scope));
  }
  const typesetter = scope.add(new Typesetter(text, defaults));
  return { text, typesetter };
}
