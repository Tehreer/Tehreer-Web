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
import { Color, TMutableText } from "tehreer";
import type { Ayah } from "../data/surah";
import { loadEngine } from "./fonts";

/** A piece of text with an optional color and link. */
export interface Segment {
  readonly text: string;
  readonly color?: string;
  readonly href?: string;
}

/** Makes something once the engine is loaded, and disposes it when the inputs change. */
export function useEngineObject<T extends { dispose(): void }>(make: () => T, inputs: readonly unknown[]): T | undefined {
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
      setObject(undefined);
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
export function useSegmentText(segments: readonly Segment[]): TMutableText | undefined {
  return useEngineObject(() => {
    const text = new TMutableText(segments.map((segment) => segment.text).join(""));
    let index = 0;
    segments.forEach((segment, i) => {
      const end = index + segment.text.length;
      if (segment.color !== undefined && end > index) {
        text.setAttributes(index, end, {
          foregroundColor: Color.parse(segment.color),
          ...(segment.href !== undefined ? { userData: i + 1 } : {}),
        });
      }
      index = end;
    });
    return text;
  }, [segments]);
}

/**
 * The verses one after another, as the Android demo makes them: a line break after the first verse
 * and two spaces after the others. The ranges of the verses are returned, and the colors of
 * their words are applied in order.
 */
export function useSurahText(ayahs: readonly Ayah[]): { text: TMutableText; ranges: { fromIndex: number; toIndex: number }[] } | undefined {
  const made = useEngineObject(() => {
    const ranges: { fromIndex: number; toIndex: number }[] = [];
    const text = new TMutableText("");
    ayahs.forEach((ayah, index) => {
      const offset = text.length;
      text.append(ayah.text);
      ranges.push({ fromIndex: offset, toIndex: offset + ayah.text.length });
      for (const attribute of ayah.attributes) {
        text.setAttributes(offset + attribute.start, offset + attribute.end, {
          foregroundColor: Color.parse(`#${attribute.color}`),
        });
      }
      text.append(index === 0 ? "\n" : "  ");
    });
    return { text, ranges, dispose: () => text.dispose() };
  }, [ayahs]);

  return made;
}
