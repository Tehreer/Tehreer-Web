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

import { useMemo, useState } from "react";
import { TextAlignment } from "tehreer";
import { PageHeader, WhenReady } from "../components/Page";
import { QuranTextView } from "../components/QuranTextView";
import { SURAH, SURAH_TITLE } from "../data/surah";
import { useFontFile } from "../lib/fonts";
import { useSurahText } from "../lib/styledText";

const MIN_TEXT_SIZE = 24;
const MAX_TEXT_SIZE = 64;
const DEFAULT_TEXT_SIZE = 36;

export function CustomTextViewPage() {
  const font = useFontFile("noorehuda");
  const typeface = useMemo(() => font.value?.typefaces.get(0), [font.value]);
  const surah = useSurahText(SURAH);
  const [size, setSize] = useState(DEFAULT_TEXT_SIZE);
  const [applied, setApplied] = useState(DEFAULT_TEXT_SIZE);
  const [selected, setSelected] = useState<number | undefined>();

  // Like the Android demo, the verse is deselected when the slider is grabbed and the text is
  // resized when it is released.

  return (
    <>
      <PageHeader title="Custom Text View" summary="A text view for long, colour-annotated Arabic text with adjustable size." />

      <div className="textview-column">
        <div className="size-control">
          <label htmlFor="size" className="size-label">Text size</label>
          <div className="size-slider">
            <span>Low</span>
            <input
              id="size"
              type="range"
              min={MIN_TEXT_SIZE}
              max={MAX_TEXT_SIZE}
              step={1}
              value={size}
              onPointerDown={() => setSelected(undefined)}
              onChange={(event) => setSize(Number(event.target.value))}
              onPointerUp={(event) => setApplied(Number(event.currentTarget.value))}
              onKeyUp={(event) => setApplied(Number(event.currentTarget.value))}
            />
            <span>High</span>
          </div>
          <span className="size-value">{size} px</span>
        </div>

        <section aria-labelledby="surah-h" className="card surah">
          <h2 id="surah-h">{SURAH_TITLE}</h2>
          <WhenReady ready={typeface !== undefined && surah !== undefined} error={font.error} what="the surah">
            <QuranTextView
              ayahRanges={surah?.ranges ?? []}
              selectedAyah={selected}
              onSelectedAyahChange={setSelected}
              scrollContainer="window"
              attributedText={surah?.text}
              typeface={typeface}
              textSize={applied}
              textColor="#111A14"
              textAlignment={TextAlignment.Center}
              isJustificationEnabled
              lineHeightMultiplier={0.8}
              separatorColor="#C9D6CC"
              aria-label={SURAH_TITLE}
              lang="ur"
              dir="rtl"
            />
          </WhenReady>
        </section>
      </div>
    </>
  );
}
