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

import { forwardRef, useMemo } from "react";
import { TTextView, type TTextViewHandle, type TTextViewProps } from "tehreer/react";

/** The code units of one verse. */
export interface AyahRange {
  readonly fromIndex: number;
  readonly toIndex: number;
}

export interface QuranTextViewProps extends Omit<TTextViewProps, "highlights" | "onTap"> {
  /** The verses of the text, in order. */
  readonly ayahRanges: readonly AyahRange[];
  /** The index of the selected verse, or `undefined` for none. It is controlled, like the `value` of an input. */
  readonly selectedAyah: number | undefined;
  /** Called with the verse that was tapped, or `undefined` when a tap lands outside of every verse. */
  readonly onSelectedAyahChange: (ayah: number | undefined) => void;
  /** The color that covers the selected verse. The default is a translucent green. */
  readonly highlightingColor?: number;
}

const DEFAULT_HIGHLIGHTING = 0x22006400;

/**
 * A `TTextView` of verses, like `QuranTextView` of the Android demo: tapping a verse selects it, and
 * tapping anywhere else deselects it. The selected verse is a prop and a change is a callback, so
 * this adds only the verses; laying out, scrolling and drawing are the text view's.
 */
export const QuranTextView = forwardRef<TTextViewHandle, QuranTextViewProps>(function QuranTextView(props, ref) {
  const { ayahRanges, selectedAyah, onSelectedAyahChange, highlightingColor = DEFAULT_HIGHLIGHTING, ...viewProps } = props;

  const highlights = useMemo(() => {
    const range = selectedAyah === undefined ? undefined : ayahRanges[selectedAyah];
    return range === undefined ? [] : [{ fromIndex: range.fromIndex, toIndex: range.toIndex, color: highlightingColor }];
  }, [ayahRanges, selectedAyah, highlightingColor]);

  const onTap = (index: number | undefined) => {
    const ayah = index === undefined ? -1 : ayahRanges.findIndex((range) => index >= range.fromIndex && index < range.toIndex);
    onSelectedAyahChange(ayah < 0 ? undefined : ayah);
  };

  return <TTextView ref={ref} {...viewProps} highlights={highlights} onTap={onTap} />;
});
