import { readCodeUnits } from "./Memory.js";
import { type Field, bool, f32, i32, ptr, struct, u32, u8, union } from "./Struct.js";

/*
 * The structs of Core, in the order of the members of the C declarations, with the names of C.
 * The tests compare every one of them with the sizes and the offsets that the compiler made.
 * A struct that Core takes or returns by value (TRPoint, TRSize, TRRect) is passed through a
 * pointer in WebAssembly; the functions of `NativeFunctions` say which.
 */

/** A `TRStringView *` that a field holds, which reads as the string, or `undefined` if it is NULL. */
export const stringPointer: Field<string | undefined> = {
  size: 4,
  alignment: 4,
  read(address) {
    return readOptionalStringView(ptr.read(address));
  },
  write() {
    throw new Error("A string view of Core is read only.");
  },
};

export const TRStringView = struct({
  buffer: ptr,
  length: ptr,
  encoding: u32,
});

/** Reads a `TRStringView *` that can be NULL, which is no string. */
export function readOptionalStringView(pointer: number): string | undefined {
  return pointer === 0 ? undefined : readStringView(pointer);
}

/** Reads a `TRStringView *`. */
export function readStringView(pointer: number): string {
  const view = TRStringView.view(pointer);
  return readCodeUnits(view.buffer, view.length, view.encoding);
}

export const TRPoint = struct({ x: f32, y: f32 });
export const TRSize = struct({ width: f32, height: f32 });
export const TRRect = struct({ x: f32, y: f32, width: f32, height: f32 });
export const TRAffineTransform = struct({ a: f32, b: f32, c: f32, d: f32, tx: f32, ty: f32 });

export const TRVariationAxis = struct({
  name: stringPointer,
  tag: u32,
  flags: u32,
  minValue: f32,
  maxValue: f32,
  defaultValue: f32,
});
export const TRBitmapStrike = struct({ pixelWidth: f32, pixelHeight: f32 });
export const TRNamedStyle = struct({
  subfamilyName: stringPointer,
  coordinatesPtr: ptr,
  coordinateCount: ptr,
  postScriptName: stringPointer,
});
export const TRPaletteEntry = struct({ name: stringPointer });
export const TRPredefinedPalette = struct({
  name: stringPointer,
  colorsPtr: ptr,
  colorCount: ptr,
  flags: u32,
});

export const TROpenTypeFeature = struct({ tag: u32, value: u32 });

/** The value of an attribute, whose member depends on its type. */
export const TRAttributeValue = union({ float: f32, uint: u32, boolean: bool, byte: u8, integer: i32 });
export const TRAttribute = struct({ type: u32, value: TRAttributeValue });

export const TRReplacementRoom = struct({ ascent: f32, descent: f32, extent: f32 });
export const TRReplacementCallbacks = struct({ computeRoom: ptr, finalize: ptr });

export const TRPathCallbacks = struct({
  moveTo: ptr,
  lineTo: ptr,
  quadTo: ptr,
  cubicTo: ptr,
  close: ptr,
});

export const TRDrawCallbacks = struct({
  drawGlyphImage: ptr,
  drawGlyphPath: ptr,
  fillRect: ptr,
  drawReplacement: ptr,
  beginShadow: ptr,
  endShadow: ptr,
});

/** All structs by their names, which the layout test goes through. */
export const structs = {
  TRStringView,
  TRPoint,
  TRSize,
  TRRect,
  TRAffineTransform,
  TRVariationAxis,
  TRBitmapStrike,
  TRNamedStyle,
  TRPaletteEntry,
  TRPredefinedPalette,
  TROpenTypeFeature,
  TRAttributeValue,
  TRAttribute,
  TRReplacementRoom,
  TRReplacementCallbacks,
  TRPathCallbacks,
  TRDrawCallbacks,
} as const;
