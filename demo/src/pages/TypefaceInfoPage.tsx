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

import { useState, useMemo } from "react";
import { TLabel } from "@tehreer/web/react";
import { PageHeader, WhenReady } from "../components/Page";
import { FontSelect } from "../components/FontSelect";
import { TEXT_FONTS, useFontFile } from "../lib/fonts";

const SPECIMEN = "زبان کو مختلف علامتوں اور رموز کے ذریعے لکھنے کو تحریر کہتے ہیں۔";

export function TypefaceInfoPage() {
  const [fontId, setFontId] = useState("taj");
  const font = useFontFile(fontId);
  const typeface = useMemo(() => font.value?.typefaces.get(0), [font.value]);

  const names: [string, string | undefined][] = typeface
    ? [
        ["Family name", typeface.familyName],
        ["Style name", typeface.styleName],
        ["Full name", typeface.fullName],
      ]
    : [];
  const metrics: [string, number][] = typeface
    ? [
        ["Units per em", typeface.unitsPerEm],
        ["Ascent", typeface.ascent],
        ["Descent", typeface.descent],
        ["Leading", typeface.leading],
        ["Glyph count", typeface.glyphCount],
      ]
    : [];

  return (
    <>
      <PageHeader title="Typeface Information" summary="Read the names and metrics of a loaded typeface.">
        <FontSelect id="face" label="Typeface" options={TEXT_FONTS} value={fontId} onChange={setFontId} className="type-select" />
      </PageHeader>

      <WhenReady ready={typeface !== undefined} error={font.error} what="the typeface">
        <section aria-labelledby="spec-h" className="card specimen">
          <h2 id="spec-h">Specimen</h2>
          <TLabel text={SPECIMEN} typeface={typeface} textSize={40} textColor="#111A14" lineHeightMultiplier={1.4} lang="ur" dir="rtl" />
        </section>

        <div className="row info-row">
          <section aria-labelledby="names-h" className="card">
            <h2 id="names-h">Names</h2>
            <dl>
              {names.map(([term, value]) => (
                <div key={term} className="dl-row">
                  <dt>{term}</dt>
                  <dd>{value ?? "—"}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="met-h" className="card">
            <h2 id="met-h">Metrics</h2>
            <dl>
              {metrics.map(([term, value]) => (
                <div key={term} className="dl-row">
                  <dt>{term}</dt>
                  <dd className="mono-cell">{value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </WhenReady>
    </>
  );
}
