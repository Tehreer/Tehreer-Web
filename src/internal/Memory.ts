import { Module } from "./Module.js";

const utf16Decoder = new TextDecoder("utf-16le");
const utf8Decoder = new TextDecoder("utf-8");
const utf8Encoder = new TextEncoder();

/** Core encodes strings in these, as `TRStringEncoding` says. */
export const StringEncodingUTF8 = 0;
export const StringEncodingUTF16 = 1;
export const StringEncodingUTF32 = 2;

/** The size of a pointer and of `TRUInteger` in WebAssembly, which is a 32-bit target. */
export const POINTER_SIZE = 4;

export function malloc(size: number): number {
  const pointer = Module._malloc(Math.max(size, 1));
  if (pointer === 0) {
    throw new Error("Out of memory.");
  }
  return pointer;
}

/** Allocates memory that is zero-filled, which a struct of callbacks needs so that it has no stray pointers. */
export function calloc(size: number): number {
  const pointer = malloc(size);
  Module.HEAPU8.fill(0, pointer, pointer + size);
  return pointer;
}

export function free(pointer: number): void {
  Module._free(pointer);
}

/** Memory on the stack of the module, which is given back when `withStack()` returns. */
export class Stack {
  /** Allocates zero-filled memory, aligned to 16 bytes. */
  alloc(size: number): number {
    const pointer = Module.stackAlloc(size);
    Module.HEAPU8.fill(0, pointer, pointer + size);
    return pointer;
  }
}

const stack = new Stack();

/** Runs a function that needs a little temporary memory for structs and out parameters. */
export function withStack<T>(body: (stack: Stack) => T): T {
  const saved = Module.stackSave();
  try {
    return body(stack);
  } finally {
    Module.stackRestore(saved);
  }
}

/** Runs a function with a copy of the string as UTF-16 code units in the memory of the module. */
export function withUtf16<T>(text: string, body: (pointer: number, length: number) => T): T {
  const length = text.length;
  const pointer = malloc(length * 2);
  try {
    // A view is taken after the allocation, as it could have grown the memory.
    const units = Module.HEAPU16;
    const start = pointer >> 1;
    for (let index = 0; index < length; index++) {
      units[start + index] = text.charCodeAt(index);
    }
    return body(pointer, length);
  } finally {
    free(pointer);
  }
}

/** Runs a function with a copy of the string as a null-terminated ASCII or UTF-8 string. */
export function withCString<T>(text: string, body: (pointer: number) => T): T {
  const bytes = utf8Encoder.encode(text);
  const pointer = malloc(bytes.length + 1);
  try {
    const heap = Module.HEAPU8;
    heap.set(bytes, pointer);
    heap[pointer + bytes.length] = 0;
    return body(pointer);
  } finally {
    free(pointer);
  }
}

/** Reads code units of the given encoding as a string. */
export function readCodeUnits(pointer: number, length: number, encoding: number): string {
  if (length === 0) {
    return "";
  }
  if (encoding === StringEncodingUTF8) {
    return utf8Decoder.decode(Module.HEAPU8.subarray(pointer, pointer + length));
  }
  if (encoding === StringEncodingUTF16) {
    return utf16Decoder.decode(Module.HEAPU8.subarray(pointer, pointer + length * 2));
  }
  const units = Module.HEAPU32.subarray(pointer >> 2, (pointer >> 2) + length);
  let text = "";
  for (let index = 0; index < length; index += 4096) {
    text += String.fromCodePoint(...units.subarray(index, Math.min(index + 4096, length)));
  }
  return text;
}

/** Copies `count` bytes out of the memory of the module. */
export function copyBytes(pointer: number, count: number): Uint8Array {
  return Module.HEAPU8.slice(pointer, pointer + count);
}
