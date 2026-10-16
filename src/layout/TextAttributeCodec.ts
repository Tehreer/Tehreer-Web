import { Typeface } from "../graphics/Typeface.js";
import { FontFeatures } from "../sfnt/FontFeatures.js";
import { Module } from "../internal/Module.js";
import { TRAttribute } from "../internal/Structs.js";
import { Replacement } from "./Replacement.js";
import type { TextAttributeName, TextAttributes } from "./TextAttributes.js";

type Kind = "typeface" | "float" | "uint" | "boolean" | "replacement" | "fontFeatures";

/** The `TRAttributeType` and the kind of the value of each attribute. */
const ATTRIBUTES: Record<TextAttributeName, readonly [type: number, kind: Kind]> = {
  typeface: [1, "typeface"],
  typeSize: [2, "float"],
  scaleX: [3, "float"],
  scaleY: [4, "float"],
  baselineOffset: [5, "float"],
  obliqueness: [6, "float"],
  replacement: [7, "replacement"],
  textAlignment: [8, "uint"],
  firstLineHeadIndent: [9, "float"],
  headIndent: [10, "float"],
  tailIndent: [11, "float"],
  firstIndentLineCount: [12, "uint"],
  paragraphSpacingBefore: [13, "float"],
  paragraphSpacing: [14, "float"],
  lineHeightMultiple: [15, "float"],
  minimumLineHeight: [16, "float"],
  maximumLineHeight: [17, "float"],
  lineSpacing: [18, "float"],
  foregroundColor: [19, "uint"],
  userData: [20, "uint"],
  languageTag: [21, "uint"],
  fontFeatures: [22, "fontFeatures"],
  backgroundColor: [23, "uint"],
  underline: [24, "boolean"],
  strikethrough: [25, "boolean"],
  decorationColor: [26, "uint"],
};

const NAMES_BY_TYPE = new Map<number, TextAttributeName>(
  (Object.entries(ATTRIBUTES) as [TextAttributeName, readonly [number, Kind]][]).map(([name, [type]]) => [type, name]),
);

export function attributeType(name: TextAttributeName): number {
  const entry = ATTRIBUTES[name];
  if (entry === undefined) {
    throw new TypeError(`Unknown text attribute: ${String(name)}`);
  }
  return entry[0];
}

/**
 * Writes an attribute to a `TRAttribute` at an address, whose memory is zeroed. It tells what has
 * to be disposed after Core has copied the attribute, which is a temporary object that was made
 * for the value.
 */
export function writeAttribute(address: number, name: TextAttributeName, value: unknown): FontFeatures | undefined {
  const [type, kind] = ATTRIBUTES[name] ?? [];
  if (type === undefined || kind === undefined) {
    throw new TypeError(`Unknown text attribute: ${String(name)}`);
  }

  const attribute = TRAttribute.view(address);
  const slot = attribute.value;
  let temporary: FontFeatures | undefined;
  attribute.type = type;

  switch (kind) {
    case "typeface":
      slot.uint = (value as Typeface).nativeHandle;
      break;
    case "replacement":
      slot.uint = (value as Replacement).nativeHandle;
      break;
    case "fontFeatures":
      if (value instanceof FontFeatures) {
        slot.uint = value.nativeHandle;
      } else {
        temporary = new FontFeatures(value as never);
        slot.uint = temporary.nativeHandle;
      }
      break;
    case "float":
      slot.float = value as number;
      break;
    case "boolean":
      slot.boolean = Boolean(value);
      break;
    case "uint":
      slot.uint = value as number;
      break;
  }
  return temporary;
}

/** Reads the attribute that a `TRAttribute` holds. */
export function readAttribute(address: number): [TextAttributeName, unknown] | undefined {
  const attribute = TRAttribute.view(address);
  const name = NAMES_BY_TYPE.get(attribute.type);
  if (name === undefined) {
    return undefined;
  }

  const slot = attribute.value;
  switch (ATTRIBUTES[name][1]) {
    case "typeface":
      return [name, Typeface.retaining(slot.uint)];
    case "replacement":
      return [name, Replacement.retaining(slot.uint)];
    case "fontFeatures":
      return [name, FontFeatures.retaining(slot.uint)];
    case "float":
      return [name, slot.float];
    case "boolean":
      return [name, slot.boolean];
    case "uint":
      return [name, slot.uint];
  }
}

/** Reads all attributes of a list of Core. */
export function readAttributeList(list: number): TextAttributes {
    const attributes: Record<string, unknown> = {};
  const count = Module._TRAttributeListGetCount(list);
  for (let index = 0; index < count; index++) {
    const entry = readAttribute(Module._TRAttributeListGetItem(list, index));
    if (entry !== undefined) {
      attributes[entry[0]] = entry[1];
    }
  }
  return attributes as TextAttributes;
}

/** Tells whether an attribute is in the attributes, and has a value. */
export function attributeNames(attributes: TextAttributes): TextAttributeName[] {
  return (Object.keys(attributes) as TextAttributeName[]).filter(
    (name) => (attributes as Record<string, unknown>)[name] !== undefined,
  );
}
