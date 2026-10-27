import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { FontFile, Typeface, TypefaceManager } from "tehreer";

const MAX_FONTS = 64;
const MAX_TYPEFACES = 1024;
const MAX_FONT_BYTES = 64 * 1024 * 1024;

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
}

const fonts = new Map<string, FontEntry>();
const typefaces = new Map<string, TypefaceEntry>();
let fontCounter = 0;
let typefaceCounter = 0;

/** Directories that `path` sources must be inside, from `TEHREER_MCP_FONT_DIRS` (path-delimiter separated). */
function allowedDirectories(): string[] | undefined {
  const value = process.env.TEHREER_MCP_FONT_DIRS;
  if (!value) {
    return undefined;
  }
  return value.split(process.platform === "win32" ? ";" : ":").filter(Boolean).map((dir) => resolve(dir));
}

async function readSource(source: FontSource): Promise<{ bytes: Uint8Array; origin: string }> {
  if ("path" in source) {
    const path = resolve(source.path);
    const allowed = allowedDirectories();
    if (allowed && !allowed.some((dir) => !relative(dir, path).startsWith("..") && !isAbsolute(relative(dir, path)))) {
      throw new Error(`The path is outside TEHREER_MCP_FONT_DIRS: ${path}`);
    }
    return { bytes: await readFile(path), origin: path };
  }
  if ("url" in source) {
    const response = await fetch(source.url);
    if (!response.ok) {
      throw new Error(`Could not fetch the font: ${source.url} (${response.status} ${response.statusText})`);
    }
    return { bytes: new Uint8Array(await response.arrayBuffer()), origin: source.url };
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

/** Keeps a typeface that was made from another one, which lives as long as the font of the parent. */
export function addDerivedTypeface(parentId: string, typeface: Typeface): string {
  const parent = typefaces.get(parentId);
  if (!parent) {
    typeface.dispose();
    throw new Error(`Unknown typefaceId "${parentId}".`);
  }
  if (typefaces.size >= MAX_TYPEFACES) {
    typeface.dispose();
    throw new Error(`Too many typefaces are loaded; unload some fonts with font_unload.`);
  }
  const typefaceId = `t${++typefaceCounter}`;
  typefaces.set(typefaceId, { typefaceId, fontId: parent.fontId, typeface, derivedFrom: parentId });
  return typefaceId;
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
