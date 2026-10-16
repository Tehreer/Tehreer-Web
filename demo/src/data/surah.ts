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

import ayahs from "./AlKahf.json";

/** One verse of the surah, from the Android demo: its text and the colored ranges inside it. */
export interface Ayah {
  readonly text: string;
  readonly attributes: readonly { readonly start: number; readonly end: number; readonly color: string }[];
}

export const SURAH_TITLE = "Al Kahf";
export const SURAH: readonly Ayah[] = ayahs;
