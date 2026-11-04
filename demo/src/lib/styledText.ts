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
import { Color, MutableTypesetter, type Typeface } from "@tehreer/web";
import type { Ayah } from "../data/surah";
import { loadEngine } from "./fonts";

/** A piece of text with an optional color and link. */
export interface Segment {
  readonly text: string;
  readonly color?: string;
  readonly href?: string;
}

/**
 * Makes something once the engine is loaded, and disposes it when the inputs change. Making
 * nothing leaves the object undefined. The old object stays until the new one is made if
 * `keepOld` is set, so what shows it is not taken away meanwhile.
 */
export function useEngineObject<T extends { dispose(): void }>(
  make: () => T | undefined, inputs: readonly unknown[], keepOld = false,
): T | undefined {
  const [object, setObject] = useState<T>();

  useEffect(() => {
    let made: T | undefined;
    let isCurrent = true;
    loadEngine().then(() => {
      if (isCurrent) {
        made = make();
        setObject(made);
      }
    });
    return () => {
      isCurrent = false;
      if (!keepOld) {
        setObject(undefined);
      }
      // A render that is already under way may still read the object, so it is released a moment later.
      const old = made;
      setTimeout(() => old?.dispose(), 100);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, inputs);

  return object;
}

/**
 * A text of the segments with their colors. A segment with an `href` gets its position plus one as
 * `userData`, which makes it a link in a `TTextView`.
 */
export function useSegmentText(
  segments: readonly Segment[], typeface: Typeface | undefined, typeSize: number,
): MutableTypesetter | undefined {
  return useEngineObject(() => {
    if (typeface === undefined) {
      return undefined;
    }
    const text = new MutableTypesetter({ typeface, typeSize });
    text.edit((editing) => {
      editing.append(segments.map((segment) => segment.text).join(""));
      let index = 0;
      segments.forEach((segment, i) => {
        const end = index + segment.text.length;
        if (segment.color !== undefined && end > index) {
          editing.setAttributes(index, end, {
            foregroundColor: Color.parse(segment.color),
            ...(segment.href !== undefined ? { userData: i + 1 } : {}),
          });
        }
        index = end;
      });
    });
    return text;
  }, [segments, typeface, typeSize]);
}

/**
 * The verses one after another, as the Android demo makes them: a line break after the first verse
 * and two spaces after the others. The ranges of the verses are returned, and the colors of
 * their words are applied in order.
 */
export function useSurahText(
  ayahs: readonly Ayah[], typeface: Typeface | undefined, typeSize: number,
): { text: MutableTypesetter; ranges: { fromIndex: number; toIndex: number }[] } | undefined {
  const made = useEngineObject(() => {
    if (typeface === undefined) {
      return undefined;
    }
    const ranges: { fromIndex: number; toIndex: number }[] = [];
    const text = new MutableTypesetter({ typeface, typeSize });
    text.edit((editing) => {
      ayahs.forEach((ayah, index) => {
        const offset = editing.length;
        editing.append(ayah.text);
        ranges.push({ fromIndex: offset, toIndex: offset + ayah.text.length });
        for (const attribute of ayah.attributes) {
          editing.setAttributes(offset + attribute.start, offset + attribute.end, {
            foregroundColor: Color.parse(`#${attribute.color}`),
          });
        }
        editing.append(index === 0 ? "\n" : "  ");
      });
    });
    return { text, ranges, dispose: () => text.dispose() };
  }, [ayahs, typeface, typeSize], true);

  return made;
}
