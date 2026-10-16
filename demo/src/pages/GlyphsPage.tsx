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

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Renderer, type Typeface } from "tehreer";
import { PageHeader, WhenReady } from "../components/Page";
import { FontSelect } from "../components/FontSelect";
import { GlyphCanvas } from "../components/GlyphCanvas";
import { GlyphDialog } from "../components/GlyphDialog";
import { TEXT_FONTS, useFontFile } from "../lib/fonts";
import { useEngineObject } from "../lib/styledText";
import { scrollContentTo, useVisibleRange } from "tehreer/react";
import { stickyStackHeight } from "../components/Sticky";

const MIN_CELL_WIDTH = 112;
const GAP = 10;
const HEADER_HEIGHT = 30;
const CANVAS_HEIGHT = 84;
const CELL_HEIGHT = HEADER_HEIGHT + CANVAS_HEIGHT + 2;
const ROW_HEIGHT = CELL_HEIGHT + GAP;
const OVERSCAN_ROWS = 2;
const GLYPH_SIZE = 40;

const hex = (value: number) => value.toString(16).toUpperCase().padStart(4, "0");

const GlyphCell = memo(function GlyphCell({ isSelected, glyphId, renderer, typeface, width, onPick }: {
  isSelected: boolean;
  glyphId: number;
  renderer: Renderer;
  typeface: Typeface;
  width: number;
  onPick: (glyphId: number) => void;
}) {
  const draw = useCallback((context: CanvasRenderingContext2D, scale: number) => {
    const sizeByEm = GLYPH_SIZE / typeface.unitsPerEm;
    const ascent = typeface.ascent * sizeByEm;
    const descent = typeface.descent * sizeByEm;
    const box = renderer.computeGlyphInkBox(glyphId);
    const x = Math.round((width - box.width) / 2 - box.x);
    const y = Math.round((CANVAS_HEIGHT - (ascent + descent)) / 2 + ascent);
    renderer.renderScale = scale;
    context.translate(x * scale, y * scale);
    renderer.drawGlyphs(context, { glyphIds: [glyphId], glyphOffsets: [{ x: 0, y: 0 }], glyphAdvances: [0] });
  }, [glyphId, renderer, typeface, width]);

  return (
    <button
      type="button"
      className="glyph-cell"
      aria-pressed={isSelected}
      aria-label={`Glyph ${hex(glyphId)}`}
      onClick={() => onPick(glyphId)}
      style={{ height: CELL_HEIGHT }}
    >
      <span className="glyph-id">{hex(glyphId)}</span>
      <GlyphCanvas width={width - 2} height={CANVAS_HEIGHT} label="" draw={draw} />
    </button>
  );
});

export function GlyphsPage() {
  const [fontId, setFontId] = useState("taj");
  const font = useFontFile(fontId);
  const typeface = useMemo(() => font.value?.typefaces.get(0), [font.value]);
  const [goTo, setGoTo] = useState("0000");
  const [selected, setSelected] = useState<number | undefined>();

  const renderer = useEngineObject(() => {
    const created = new Renderer();
    created.typeface = typeface!;
    created.typeSize = GLYPH_SIZE;
    return created;
  }, [typeface]);

  const grid = useRef<HTMLDivElement>(null);
  const [gridWidth, setGridWidth] = useState(0);

  useLayoutEffect(() => {
    const element = grid.current;
    if (element === null) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box !== undefined) {
        setGridWidth(Math.floor(box.width));
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const glyphCount = typeface?.glyphCount ?? 0;
  const columns = Math.max(1, Math.floor((gridWidth + GAP) / (MIN_CELL_WIDTH + GAP)));
  const cellWidth = Math.floor((gridWidth - GAP * (columns - 1)) / columns);
  const rowCount = Math.ceil(glyphCount / columns);
  const gridHeight = Math.max(rowCount * ROW_HEIGHT - GAP, 0);

  // The page scrolls, so the rows in view are the ones that the window shows of the grid.
  const range = useVisibleRange(grid, undefined, [gridHeight, gridWidth]);
  const firstRow = Math.max(0, Math.floor(range.top / ROW_HEIGHT) - OVERSCAN_ROWS);
  const lastRow = Math.min(rowCount - 1, Math.ceil(range.bottom / ROW_HEIGHT) + OVERSCAN_ROWS);
  const firstGlyph = firstRow * columns;
  const lastGlyph = Math.min(glyphCount - 1, (lastRow + 1) * columns - 1);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setGoTo("0000");
    setSelected(undefined);
  }, [fontId]);

  /** What sticks at the top of the page: the header, with a gap. */
  const stuck = () => stickyStackHeight("--header-height") + 12;

  const jump = () => {
    const id = Number.parseInt(goTo, 16);
    if (Number.isNaN(id) || glyphCount === 0 || grid.current === null) {
      return;
    }
    const target = Math.min(Math.max(id, 0), glyphCount - 1);
    setGoTo(hex(target));
    scrollContentTo(grid.current, Math.floor(target / columns) * ROW_HEIGHT - stuck());
  };

  const select = useCallback((id: number) => {
    setSelected(id);
    const element = grid.current;
    if (element !== null) {
      const top = element.getBoundingClientRect().top + Math.floor(id / columns) * ROW_HEIGHT;
      const covered = stickyStackHeight("--header-height") + 12;
      if (top < covered) {
        window.scrollBy({ top: top - covered });
      } else if (top + CELL_HEIGHT > window.innerHeight) {
        window.scrollBy({ top: top + CELL_HEIGHT - window.innerHeight });
      }
    }
  }, [columns]);
  const close = useCallback(() => setSelected(undefined), []);

  const cells = [];
  for (let id = firstGlyph; id <= lastGlyph && renderer !== undefined && typeface !== undefined; id++) {
    cells.push(<GlyphCell key={id} isSelected={id === selected} glyphId={id} renderer={renderer} typeface={typeface} width={cellWidth} onPick={setSelected} />);
  }

  return (
    <>
      <PageHeader title="Typeface Glyphs" summary="Every glyph in the typeface, in glyph ID order. Select one to inspect it." />

      <div className="toolbar">
        <div className="toolbar-fields">
          <FontSelect id="face" label="Typeface" options={TEXT_FONTS} value={fontId} onChange={setFontId} />
          <div className="field">
            <label htmlFor="goto">Go to glyph ID</label>
            <input
              id="goto"
              type="text"
              className="mono goto"
              value={goTo}
              onChange={(event) => setGoTo(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && jump()}
              onBlur={jump}
            />
          </div>
        </div>
        <span className="meta">{glyphCount > 0 ? `${glyphCount} glyphs` : "—"}</span>
      </div>

      <div ref={grid} className="glyph-host" role="region" aria-label="Glyph grid" style={{ height: gridHeight }}>
        <WhenReady ready={typeface !== undefined && renderer !== undefined} error={font.error} what="the typeface">
          <div
            className="glyph-grid"
            style={{
              position: "absolute", top: firstRow * ROW_HEIGHT, left: 0, right: 0,
              gridTemplateColumns: `repeat(${columns}, ${cellWidth}px)`, gap: GAP,
            }}
          >
            {cells}
          </div>
        </WhenReady>
      </div>

      {selected !== undefined && typeface !== undefined && (
        <GlyphDialog typeface={typeface} glyphId={selected} onSelect={select} onClose={close} />
      )}
    </>
  );
}
