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

import { Fragment, useCallback, useMemo, useState } from "react";
import { Renderer, ShapingEngine, SfntTag, type Typeface } from "@tehreer/web";
import { PageHeader, WhenReady } from "../components/Page";
import { FontSelect } from "../components/FontSelect";
import { GlyphCanvas } from "../components/GlyphCanvas";
import { TEXT_FONTS, useFontFile } from "../lib/fonts";
import { useEngineObject } from "../lib/styledText";

const DEFAULT_TEXT = "زبان کو مختلف علامتوں اور رموز کے ذریعے لکھنے کو تحریر کہتے ہیں۔";

interface Settings {
  readonly typeSize: number;
  readonly script: string;
  readonly language: string;
  readonly text: string;
}

interface GlyphInfo {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly advance: number;
}

interface Cluster {
  readonly characters: string[];
  readonly glyphs: GlyphInfo[];
}

const hex = (value: number) => value.toString(16).toUpperCase().padStart(4, "0");
const round = (value: number) => Math.trunc(value + 0.5);

function isValidTag(tag: string): boolean {
  try {
    SfntTag.make(tag);
    return true;
  } catch {
    return false;
  }
}

function describe(character: string): string {
  const code = hex(character.codePointAt(0)!);
  return character === " " ? `${code} (space)` : `${code} (\u2066${character}\u2069)`;
}

/** Shapes the text and groups characters and glyphs by cluster, copying what it needs out of Core. */
function shape(typeface: Typeface, settings: Settings): Cluster[] {
  const engine = new ShapingEngine();
  try {
    const scriptTag = SfntTag.make(settings.script);
    engine.typeface = typeface;
    engine.typeSize = settings.typeSize;
    engine.scriptTag = scriptTag;
    engine.languageTag = SfntTag.make(settings.language);
    engine.writingDirection = ShapingEngine.getScriptDefaultDirection(scriptTag);

    const result = engine.shapeText(settings.text, 0, settings.text.length);
    try {
      const clusterMap = result.clusterMap.toArray();
      const ids = result.glyphIds.toArray();
      const offsets = result.glyphOffsets.toArray();
      const advances = result.glyphAdvances.toArray();
      const starts = [...new Set(clusterMap)].sort((a, b) => a - b);

      const clusters: Cluster[] = [];
      let index = 0;
      while (index < clusterMap.length) {
        const glyphStart = clusterMap[index]!;
        let end = index;
        while (end < clusterMap.length && clusterMap[end] === glyphStart) {
          end++;
        }
        const next = starts[starts.indexOf(glyphStart) + 1] ?? ids.length;

        const characters: string[] = [];
        for (const character of settings.text.slice(index, end)) {
          characters.push(describe(character));
        }
        const glyphs: GlyphInfo[] = [];
        for (let g = glyphStart; g < next; g++) {
          glyphs.push({ id: ids[g]!, x: round(offsets[g]!.x), y: round(offsets[g]!.y), advance: round(advances[g]!) });
        }
        clusters.push({ characters, glyphs });
        index = end;
      }
      return clusters;
    } finally {
      result.dispose();
    }
  } finally {
    engine.dispose();
  }
}

const GLYPH_DISPLAY_SIZE = 28;

/** What a glyph image needs: a renderer that scales the type size to the display size. */
interface GlyphDrawing {
  readonly renderer: Renderer;
  readonly typeface: Typeface;
  readonly scale: number;
}

/** A glyph, drawn small at its place in the table next to its ID. */
function GlyphThumb({ drawing, glyphId }: { drawing: GlyphDrawing; glyphId: number }) {
  const { renderer, typeface, scale } = drawing;
  const sizeByEm = GLYPH_DISPLAY_SIZE / typeface.unitsPerEm;
  const ascent = typeface.ascent * sizeByEm;
  const descent = typeface.descent * sizeByEm;
  const box = renderer.computeGlyphInkBox(glyphId);
  const width = Math.ceil(box.width);
  const height = Math.ceil(ascent + descent);

  const draw = useCallback((context: CanvasRenderingContext2D, pixelRatio: number) => {
    renderer.renderScale = pixelRatio;
    context.translate(Math.round(-box.x) * pixelRatio, Math.round(ascent) * pixelRatio);
    renderer.drawGlyphs(context, { glyphIds: [glyphId], glyphOffsets: [{ x: 0, y: 0 }], glyphAdvances: [0] });
  }, [renderer, glyphId, box.x, ascent]);

  return (
    <span className="glyph-thumb" data-scale={scale} style={{ verticalAlign: `${-descent}px` }}>
      <GlyphCanvas width={width} height={height} label="" draw={draw} />
    </span>
  );
}

function GlyphName({ drawing, glyphId }: { drawing: GlyphDrawing | undefined; glyphId: number }) {
  return (
    <>
      {hex(glyphId)} (
      {drawing !== undefined && <GlyphThumb drawing={drawing} glyphId={glyphId} />}
      )
    </>
  );
}

function ClusterRows({ cluster, drawing }: { cluster: Cluster; drawing: GlyphDrawing | undefined }) {
  const rows = Math.max(cluster.characters.length, cluster.glyphs.length);
  const charSpan = cluster.characters.length === 1 ? rows : 1;
  const glyphSpan = cluster.glyphs.length === 1 ? rows : 1;

  return (
    <tbody>
      {Array.from({ length: rows }, (_, row) => {
        const character = cluster.characters[row];
        const glyph = cluster.glyphs[row];
        return (
          <tr key={row}>
            {(row === 0 || charSpan === 1) && (
              <td rowSpan={charSpan} className="mono-cell char-cell" dir="ltr">{character}</td>
            )}
            {(row === 0 || glyphSpan === 1) && (
              <>
                <td rowSpan={glyphSpan} className="mono-cell glyph-col">{glyph ? <GlyphName drawing={drawing} glyphId={glyph.id} /> : ""}</td>
                <td rowSpan={glyphSpan} className="mono-cell glyph-col">{glyph ? `(${glyph.x}, ${glyph.y})` : ""}</td>
                <td rowSpan={glyphSpan} className="mono-cell glyph-col">{glyph ? glyph.advance : ""}</td>
              </>
            )}
          </tr>
        );
      })}
    </tbody>
  );
}

export function ShapingPage() {
  const [fontId, setFontId] = useState("taj");
  const font = useFontFile(fontId);
  const typeface = useMemo(() => font.value?.typefaces.get(0), [font.value]);

  const [size, setSize] = useState("2048");
  const [script, setScript] = useState("arab");
  const [language, setLanguage] = useState("dflt");
  const [text, setText] = useState(DEFAULT_TEXT);
  const [applied, setApplied] = useState<Settings>({ typeSize: 2048, script: "arab", language: "dflt", text: DEFAULT_TEXT });
  const [problem, setProblem] = useState<string | undefined>();

  const apply = () => {
    const typeSize = Number.parseInt(size, 10);
    if (!Number.isFinite(typeSize) || typeSize <= 0) {
      setProblem("Write a valid type size!");
    } else if (!isValidTag(script)) {
      setProblem("Write a valid script tag!");
    } else if (!isValidTag(language)) {
      setProblem("Write a valid language tag!");
    } else {
      setProblem(undefined);
      setApplied({ typeSize, script, language, text });
    }
  };

  const renderer = useEngineObject(() => {
    const created = new Renderer();
    created.typeface = typeface!;
    created.typeSize = applied.typeSize;
    const scale = GLYPH_DISPLAY_SIZE / applied.typeSize;
    created.scaleX = scale;
    created.scaleY = scale;
    return created;
  }, [typeface, applied.typeSize]);
  const drawing = useMemo<GlyphDrawing | undefined>(
    () => (renderer !== undefined && typeface !== undefined ? { renderer, typeface, scale: GLYPH_DISPLAY_SIZE / applied.typeSize } : undefined),
    [renderer, typeface, applied.typeSize],
  );

  const clusters = useMemo(() => (typeface ? shape(typeface, applied) : undefined), [typeface, applied]);

  return (
    <>
      <PageHeader title="OpenType Shaping" summary="Shape text with script and language tags, then inspect each glyph's ID, offset and advance." />

      <div className="row">
        <section aria-labelledby="set-h" className="card settings">
          <h2 id="set-h">Settings</h2>
          <FontSelect id="face" label="Typeface" options={TEXT_FONTS} value={fontId} onChange={setFontId} />
          <div className="field">
            <label htmlFor="size">Type size</label>
            <input id="size" type="text" inputMode="numeric" className="mono" value={size} onChange={(e) => setSize(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="script">Script tag</label>
            <input id="script" type="text" className="mono" value={script} onChange={(e) => setScript(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="lang">Language tag</label>
            <input id="lang" type="text" className="mono" value={language} onChange={(e) => setLanguage(e.target.value)} />
          </div>
          {problem !== undefined && <p className="invalid" role="alert">{problem}</p>}
          <button type="button" className="primary" onClick={apply}>Shape</button>
        </section>

        <div className="shaping-results">
          <section aria-labelledby="txt-h" className="card">
            <label id="txt-h" htmlFor="input-text" className="card-label">Input text</label>
            <textarea id="input-text" lang="ur" dir="rtl" rows={2} className="urdu-input" value={text} onChange={(e) => setText(e.target.value)} />
          </section>

          <section aria-labelledby="res-h" className="card">
            <div className="card-head">
              <h2 id="res-h">OpenType Info</h2>
              <span className="meta">Grouped by cluster</span>
            </div>
            <WhenReady ready={clusters !== undefined} error={font.error} what="the typeface">
              <div className="table-scroll shaping-table">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Character</th>
                      <th scope="col">Glyph ID</th>
                      <th scope="col">Glyph Offset</th>
                      <th scope="col">Glyph Advance</th>
                    </tr>
                  </thead>
                  {clusters?.map((cluster, index) => (
                    <Fragment key={index}>
                      <ClusterRows cluster={cluster} drawing={drawing} />
                    </Fragment>
                  ))}
                </table>
              </div>
            </WhenReady>
          </section>
        </div>
      </div>
    </>
  );
}
