import { open } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { isIP } from "node:net";
import { FontFile, Typeface, TypefaceManager } from "tehreer";

const MAX_FONTS = 64;
const MAX_TYPEFACES = 1024;
export const MAX_FONT_BYTES = 64 * 1024 * 1024;
const FETCH_TIMEOUT_MS = Number(process.env.TEHREER_MCP_FETCH_TIMEOUT_MS) || 30_000;
const MAX_REDIRECTS = 3;

export type FontSource = { path: string } | { url: string } | { base64: string };

export interface FontEntry {
  readonly fontId: string;
  readonly name: string;
  readonly origin: string;
  readonly file: FontFile;
  /** The ids of the typefaces of the file, in order. */
  readonly faceIds: string[];
}

interface TypefaceEntry {
  readonly typefaceId: string;
  readonly fontId: string;
  readonly typeface: Typeface;
  /** Tells whether the entry was made from another one by `font_instance`. */
  readonly derivedFrom?: string;
  /** What the instance was made with, so that the same request gives the same entry. */
  readonly instanceKey?: string;
}

const fonts = new Map<string, FontEntry>();
const typefaces = new Map<string, TypefaceEntry>();
let fontCounter = 0;
let typefaceCounter = 0;

/** The directories that an environment variable limits paths to (path-delimiter separated), if it is set. */
export function allowedDirectories(variable: string): string[] | undefined {
  const value = process.env[variable];
  if (!value) {
    return undefined;
  }
  return value.split(process.platform === "win32" ? ";" : ":").filter(Boolean).map((dir) => resolve(dir));
}

/** Throws if the variable is set and the path is not inside one of its directories. */
export function checkAllowedPath(path: string, variable: string): void {
  const allowed = allowedDirectories(variable);
  if (allowed && !allowed.some((dir) => !relative(dir, path).startsWith("..") && !isAbsolute(relative(dir, path)))) {
    throw new Error(`The path is outside ${variable}: ${path}`);
  }
}

function tooLarge(): Error {
  return new Error(`The font is larger than the limit of ${MAX_FONT_BYTES} bytes.`);
}

/** Reads a regular file, refusing devices, directories and anything over the limit before reading it. */
async function readFontFile(path: string): Promise<Uint8Array> {
  const file = await open(path, "r");
  try {
    const info = await file.stat();
    if (!info.isFile()) {
      throw new Error(`Not a regular file: ${path}`);
    }
    if (info.size > MAX_FONT_BYTES) {
      throw tooLarge();
    }
    const bytes = Buffer.alloc(info.size);
    let read = 0;
    while (read < bytes.length) {
      const { bytesRead } = await file.read(bytes, read, bytes.length - read, read);
      if (bytesRead === 0) {
        break;
      }
      read += bytesRead;
    }
    return bytes.subarray(0, read);
  } finally {
    await file.close();
  }
}

function isLocalHost(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return true;
  }
  const family = isIP(host);
  if (family === 4) {
    const [a, b] = host.split(".").map(Number) as [number, number];
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (family === 6) {
    return host === "::1" || host === "::" || /^f[cd]/.test(host) || host.startsWith("fe80") || host.startsWith("::ffff:");
  }
  return false;
}

function checkUrl(url: URL): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Only http and https URLs are supported: ${url.protocol}`);
  }
  if (isLocalHost(url.hostname) && process.env.TEHREER_MCP_ALLOW_LOCAL_URLS !== "1") {
    throw new Error("URLs that point to this machine or a private network are refused; set TEHREER_MCP_ALLOW_LOCAL_URLS=1 to allow them.");
  }
}

/** Downloads a font with a timeout and a limit on its size, which is enforced while streaming. */
async function fetchFont(source: string): Promise<Uint8Array> {
  let url = new URL(source);
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  for (let redirects = 0; ; redirects++) {
    checkUrl(url);
    const response = await fetch(url, { signal, redirect: "manual" });
    if (response.status >= 300 && response.status < 400 && response.headers.has("location")) {
      await response.body?.cancel();
      if (redirects >= MAX_REDIRECTS) {
        throw new Error("Too many redirects.");
      }
      url = new URL(response.headers.get("location")!, url);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Could not fetch the font: ${url} (${response.status} ${response.statusText})`);
    }
    const length = Number(response.headers.get("content-length"));
    if (length > MAX_FONT_BYTES) {
      await response.body?.cancel();
      throw tooLarge();
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    const reader = response.body?.getReader();
    while (reader) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      total += value.length;
      if (total > MAX_FONT_BYTES) {
        await reader.cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  }
}

async function readSource(source: FontSource): Promise<{ bytes: Uint8Array; origin: string }> {
  if ("path" in source) {
    const path = resolve(source.path);
    checkAllowedPath(path, "TEHREER_MCP_FONT_DIRS");
    return { bytes: await readFontFile(path), origin: path };
  }
  if ("url" in source) {
    return { bytes: await fetchFont(source.url), origin: source.url };
  }
  if (source.base64.length > Math.ceil((MAX_FONT_BYTES * 4) / 3) + 4) {
    throw tooLarge();
  }
  return { bytes: Buffer.from(source.base64, "base64"), origin: "base64" };
}

function describeBaseName(origin: string): string {
  return origin.split(/[\\/]/).pop() || origin;
}

/** Loads a font file, registers its faces and returns the entry. */
export async function loadFont(source: FontSource, name?: string): Promise<FontEntry> {
  if (fonts.size >= MAX_FONTS) {
    throw new Error(`At most ${MAX_FONTS} fonts can be loaded; unload some with font_unload.`);
  }
  const { bytes, origin } = await readSource(source);
  if (bytes.length === 0 || bytes.length > MAX_FONT_BYTES) {
    throw new Error(`The font must be between 1 byte and ${MAX_FONT_BYTES} bytes (got ${bytes.length}).`);
  }

  const file = new FontFile(bytes);
  const list = file.typefaces;
  if (typefaces.size + list.length > MAX_TYPEFACES) {
    file.dispose();
    throw new Error(`Too many typefaces are loaded; unload some fonts with font_unload.`);
  }

  const fontId = `f${++fontCounter}`;
  const faceIds: string[] = [];
  for (const typeface of list) {
    const typefaceId = `t${++typefaceCounter}`;
    typefaces.set(typefaceId, { typefaceId, fontId, typeface });
    faceIds.push(typefaceId);
    TypefaceManager.registerTypeface(typeface);
  }

  const entry: FontEntry = { fontId, name: name ?? describeBaseName(origin), origin, file, faceIds };
  fonts.set(fontId, entry);
  return entry;
}

export function unloadFont(fontId: string): void {
  const entry = getFont(fontId);
  for (const [id, face] of typefaces) {
    if (face.fontId === fontId) {
      TypefaceManager.unregisterTypeface(face.typeface);
      face.typeface.dispose();
      typefaces.delete(id);
    }
  }
  entry.file.dispose();
  fonts.delete(fontId);
}

export function getFont(fontId: string): FontEntry {
  const entry = fonts.get(fontId);
  if (!entry) {
    throw new Error(`Unknown fontId "${fontId}". Load a font with font_load first.`);
  }
  return entry;
}

export function listFonts(): FontEntry[] {
  return [...fonts.values()];
}

export function getTypeface(typefaceId: string): Typeface {
  const entry = typefaces.get(typefaceId);
  if (!entry) {
    throw new Error(`Unknown typefaceId "${typefaceId}". Use font_load or font_list to find valid ids.`);
  }
  return entry.typeface;
}

export function fontIdOf(typefaceId: string): string {
  return typefaces.get(typefaceId)?.fontId ?? "";
}

export function derivedFromOf(typefaceId: string): string | undefined {
  return typefaces.get(typefaceId)?.derivedFrom;
}

/** Finds the instance that an earlier request made from a typeface with the same key. */
export function findInstance(parentId: string, key: string): string | undefined {
  for (const entry of typefaces.values()) {
    if (entry.derivedFrom === parentId && entry.instanceKey === key) {
      return entry.typefaceId;
    }
  }
  return undefined;
}

/** Keeps a typeface that was made from another one, which lives until it is released or its font is unloaded. */
export function addDerivedTypeface(parentId: string, typeface: Typeface, instanceKey: string): string {
  const parent = typefaces.get(parentId);
  if (!parent) {
    typeface.dispose();
    throw new Error(`Unknown typefaceId "${parentId}".`);
  }
  if (typefaces.size >= MAX_TYPEFACES) {
    typeface.dispose();
    throw new Error(`Too many typefaces are loaded; release instances with font_release or unload fonts with font_unload.`);
  }
  const typefaceId = `t${++typefaceCounter}`;
  typefaces.set(typefaceId, { typefaceId, fontId: parent.fontId, typeface, derivedFrom: parentId, instanceKey });
  return typefaceId;
}

/** Frees an instance made by `font_instance`, and the instances made from it. Faces of a font file are kept. */
export function releaseInstance(typefaceId: string): string[] {
  const entry = typefaces.get(typefaceId);
  if (!entry) {
    throw new Error(`Unknown typefaceId "${typefaceId}".`);
  }
  if (entry.derivedFrom === undefined) {
    throw new Error(`"${typefaceId}" is a face of a font file; unload the font with font_unload.`);
  }
  const released = [typefaceId];
  for (const child of typefaces.values()) {
    if (child.derivedFrom === typefaceId) {
      released.push(...releaseInstance(child.typefaceId));
    }
  }
  entry.typeface.dispose();
  typefaces.delete(typefaceId);
  return released;
}

/** Finds the id of a typeface that the registry holds, comparing by identity of the native object. */
export function idOfTypeface(typeface: Typeface): string | undefined {
  for (const entry of typefaces.values()) {
    if (entry.typeface.equals(typeface)) {
      return entry.typefaceId;
    }
  }
  return undefined;
}

export function typefaceIdsOfFont(fontId: string): string[] {
  return [...typefaces.values()].filter((entry) => entry.fontId === fontId).map((entry) => entry.typefaceId);
}
