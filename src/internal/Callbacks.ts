import type { PathSink } from "../graphics/PathSink.js";
import type { Color } from "../Color.js";
import type { Rect } from "../geometry.js";
import { calloc } from "./Memory.js";
import { u8 } from "./Struct.js";
import {
  TRDrawCallbacks, TRPathCallbacks, TRPoint, TRRect, TRReplacementCallbacks, TRReplacementRoom, readStringView,
} from "./Structs.js";
import { Module } from "./Module.js";

/**
 * Core calls back through function pointers that carry an opaque `userData` pointer. The pointers
 * to the functions below are made once, and `userData` is the key of a handler in a table, so no
 * function has to be added to the table of the module while the library is used.
 */
export class HandlerTable<T> {
  readonly #items = new Map<number, T>();
  #next = 1;

  /** Adds a handler, and returns the key to pass to Core as `userData`. It is never 0. */
  add(handler: T): number {
    const key = this.#next++;
    this.#items.set(key, handler);
    return key;
  }

  get(key: number): T | undefined {
    return this.#items.get(key);
  }

  remove(key: number): void {
    this.#items.delete(key);
  }

  get size(): number {
    return this.#items.size;
  }
}

/** The functions that draw a glyph run, a line or a frame call, which a renderer is given. */
export interface DrawTarget {
  /** Draws the image of a glyph. The image is valid until the function returns. */
  drawGlyphImage(
    image: number,
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    color: Color,
    clip: Rect | undefined,
  ): void;
  fillRect(rect: Rect, color: Color): void;
  /** Draws the replacement of a run, at the start of the run on its baseline. */
  drawReplacement(run: number, x: number, y: number): void;
  beginShadow(radius: number, dx: number, dy: number, color: Color): void;
  endShadow(): void;
}

/** What a replacement gives to Core, and what it is drawn with. */
export interface ReplacementState {
  computeRoom(layoutWidth: number): { ascent: number; descent: number; extent: number };
  /** The address of the replacement of Core, which is set once it is created. */
  handle: number;
  /** What the owner of the replacement wants to draw it with. */
  readonly delegate: unknown;
}

export const pathSinks = new HandlerTable<PathSink>();
export const drawTargets = new HandlerTable<DrawTarget>();
export const collectors = new HandlerTable<unknown[]>();
export const replacements = new HandlerTable<ReplacementState>();
/** The replacement of Core to the key of its state. */
export const replacementKeys = new Map<number, number>();
/** What a glyph image has attached to itself with `TRGlyphImageSetNativeData()`. */
export const imageData = new HandlerTable<unknown>();

/** The addresses of the functions and structs that are given to Core. */
export interface CallbackPointers {
  readonly pathCallbacks: number;
  readonly drawCallbacks: number;
  readonly emptyDrawCallbacks: number;
  readonly replacementCallbacks: number;
  readonly selectionFunc: number;
  readonly edgeFunc: number;
  readonly lineLocatorFunc: number;
  readonly placementFunc: number;
  readonly typefaceCallback: number;
  readonly familyCallback: number;
  readonly imageDestroy: number;
}

let pointers: CallbackPointers | undefined;

export function callbackPointers(): CallbackPointers {
  if (pointers === undefined) {
    throw new Error("Tehreer is not initialized: await initialize() before using it.");
  }
  return pointers;
}

// An error that a handler throws cannot pass through the frames of Core, so it is kept until the
// call of Core that made the callback returns, and thrown from there.
let failed = false;
let failure: unknown;

function guard(stop: number, body: () => void): void {
  try {
    body();
  } catch (error) {
    if (!failed) {
      failed = true;
      failure = error;
    }
    if (stop !== 0) {
      u8.write(stop, 1);
    }
  }
}

/** Runs a call of Core that can call back, and throws what a handler has thrown meanwhile. */
export function callingBack<T>(call: () => T): T {
  const result = call();
  if (failed) {
    const error = failure;
    failed = false;
    failure = undefined;
    throw error;
  }
  return result;
}

/** Runs a call of Core that collects the items that Core passes to a function. */
export function collect<T>(call: (userData: number) => void): T[] {
  const items: T[] = [];
  const key = collectors.add(items);
  try {
    callingBack(() => call(key));
  } finally {
    collectors.remove(key);
  }
  return items;
}

/**
 * Makes the pointers to the functions that Core calls, once.
 *
 * Each signature is the WebAssembly one: pointers and integers are `i`, floats are `f`, and a
 * struct that is passed by value (`TRPoint`, `TRRect`) is the address of a copy.
 */
export function installCallbacks(): void {
  const add = (callback: (...args: never[]) => unknown, signature: string): number =>
    Module.addFunction(callback, signature);

  const pathCallbacks = calloc(TRPathCallbacks.size);
  TRPathCallbacks.assign(pathCallbacks, {
    moveTo: add((userData: number, x: number, y: number, stop: number) =>
      guard(stop, () => pathSinks.get(userData)?.moveTo(x, y)), "viffi"),
    lineTo: add((userData: number, x: number, y: number, stop: number) =>
      guard(stop, () => pathSinks.get(userData)?.lineTo(x, y)), "viffi"),
    quadTo: add((userData: number, cx: number, cy: number, x: number, y: number, stop: number) =>
      guard(stop, () => pathSinks.get(userData)?.quadTo(cx, cy, x, y)), "viffffi"),
    cubicTo: add((userData: number, c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number, stop: number) =>
      guard(stop, () => pathSinks.get(userData)?.cubicTo(c1x, c1y, c2x, c2y, x, y)), "viffffffi"),
    close: add((userData: number, stop: number) =>
      guard(stop, () => pathSinks.get(userData)?.close()), "vii"),
  });

  // drawGlyphPath is not set, so glyphs are drawn as images.
  const drawCallbacks = calloc(TRDrawCallbacks.size);
  TRDrawCallbacks.assign(drawCallbacks, {
    drawGlyphImage: add((userData: number, image: number, origin: number, scaleX: number, scaleY: number, color: number, clip: number) =>
      guard(0, () => {
        const position = TRPoint.view(origin);
        drawTargets.get(userData)?.drawGlyphImage(
          image, position.x, position.y, scaleX, scaleY, color >>> 0, clip === 0 ? undefined : TRRect.snapshot(clip));
      }), "viiiffii"),
    fillRect: add((userData: number, rect: number, color: number) =>
      guard(0, () => drawTargets.get(userData)?.fillRect(TRRect.snapshot(rect), color >>> 0)), "viii"),
    drawReplacement: add((userData: number, run: number, origin: number) =>
      guard(0, () => {
        const position = TRPoint.view(origin);
        drawTargets.get(userData)?.drawReplacement(run, position.x, position.y);
      }), "viii"),
    beginShadow: add((userData: number, radius: number, dx: number, dy: number, color: number) =>
      guard(0, () => drawTargets.get(userData)?.beginShadow(radius, dx, dy, color >>> 0)), "vifffi"),
    endShadow: add((userData: number) => guard(0, () => drawTargets.get(userData)?.endShadow()), "vi"),
  });

  const replacementCallbacks = calloc(TRReplacementCallbacks.size);
  TRReplacementCallbacks.assign(replacementCallbacks, {
    computeRoom: add((userData: number, layoutWidth: number, room: number) =>
      guard(0, () => {
        const result = replacements.get(userData)?.computeRoom(layoutWidth);
        TRReplacementRoom.assign(room, result ?? { ascent: 0, descent: 0, extent: 0 });
      }), "vifi"),
    finalize: add((userData: number) => {
      const state = replacements.get(userData);
      if (state !== undefined) {
        replacementKeys.delete(state.handle);
        replacements.remove(userData);
      }
    }, "vi"),
  });

  pointers = {
    pathCallbacks,
    drawCallbacks,
    emptyDrawCallbacks: calloc(TRDrawCallbacks.size),
    replacementCallbacks,
    selectionFunc: add((userData: number, rect: number, stop: number) =>
      guard(stop, () => collectors.get(userData)?.push(TRRect.snapshot(rect))), "viii"),
    edgeFunc: add((userData: number, left: number, right: number, stop: number) =>
      guard(stop, () => collectors.get(userData)?.push({ left, right })), "viffi"),
    lineLocatorFunc: add((userData: number, lineIndex: number, stop: number) =>
      guard(stop, () => collectors.get(userData)?.push(lineIndex)), "viii"),
    placementFunc: add((userData: number, glyphIndex: number, image: number, origin: number, scaleX: number, scaleY: number, stop: number) =>
      guard(stop, () => {
        const position = TRPoint.view(origin);
        // The image is valid only while this function runs, so the list keeps a reference of its own.
        collectors.get(userData)?.push({
          glyphIndex, image: Module._TRGlyphImageRetain(image), x: position.x, y: position.y, scaleX, scaleY,
        });
      }), "viiiiffi"),
    typefaceCallback: add((typeface: number, context: number, stop: number) =>
      guard(stop, () => collectors.get(context)?.push(typeface)), "viii"),
    familyCallback: add((familyId: number, name: number, context: number, stop: number) =>
      guard(stop, () => collectors.get(context)?.push({ familyId, name: readStringView(name) })), "viiii"),
    imageDestroy: add((data: number) => imageData.remove(data), "vi"),
  };
}
