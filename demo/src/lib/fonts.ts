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

import { useEffect, useState } from "react";
import { FontFile, initialize } from "@tehreer/web";

export interface FontOption {
  readonly id: string;
  readonly label: string;
  readonly url: string;
}

const base = import.meta.env.BASE_URL;
const url = (name: string) => `${base}fonts/${encodeURIComponent(name)}`;

export const TEXT_FONTS: readonly FontOption[] = [
  { id: "taj", label: "AlQalam Taj Nastaleeq", url: url("TajNastaleeq.ttf") },
  { id: "mehr", label: "Mehr Nastaliq Web", url: url("MehrNastaliq.ttf") },
  { id: "nafees", label: "Nafees Web Naskh", url: url("NafeesWeb.ttf") },
  { id: "noorehuda", label: "Noorehuda", url: url("Noorehuda.ttf") },
];

export const VARIABLE_FONTS: readonly FontOption[] = [
  { id: "rocher", label: "RocherColor", url: url("RocherColor.ttf") },
  { id: "decovar", label: "Decovar Alpha", url: url("Decovar Alpha.ttf") },
  { id: "sudo", label: "Sudo", url: url("Sudo.ttf") },
  { id: "league", label: "League Mono", url: url("League Mono.ttf") },
];

const ALL_FONTS = [...TEXT_FONTS, ...VARIABLE_FONTS];

let engine: Promise<void> | undefined;
const files = new Map<string, Promise<FontFile>>();

/** Loads the WebAssembly module once. */
export function loadEngine(): Promise<void> {
  engine ??= initialize();
  return engine;
}

/** Loads a font once. The file stays alive for the whole session, so its typefaces stay valid. */
export function loadFont(id: string): Promise<FontFile> {
  let file = files.get(id);
  if (file === undefined) {
    const option = ALL_FONTS.find((font) => font.id === id);
    if (option === undefined) {
      throw new Error(`Unknown font: ${id}`);
    }
    file = loadEngine().then(() => FontFile.fromUrl(option.url));
    files.set(id, file);
  }
  return file;
}

export interface Loaded<T> {
  readonly value: T | undefined;
  readonly error: Error | undefined;
}

/** Runs an async loader whenever `key` changes, ignoring results of stale runs. */
export function useLoaded<T>(key: string, load: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<{ key: string; value?: T; error?: Error }>({ key });

  useEffect(() => {
    let isCurrent = true;
    load().then(
      (value) => isCurrent && setState({ key, value }),
      (error: unknown) => isCurrent && setState({ key, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      isCurrent = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const isStale = state.key !== key;
  return { value: isStale ? undefined : state.value, error: isStale ? undefined : state.error };
}

/** The engine, ready to use. */
export function useEngine(): Loaded<true> {
  return useLoaded("engine", () => loadEngine().then(() => true as const));
}

/** The font file with the id, once the engine and the file are loaded. */
export function useFontFile(id: string): Loaded<FontFile> {
  return useLoaded(id, () => loadFont(id));
}
