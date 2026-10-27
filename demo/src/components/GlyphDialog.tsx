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

import { useCallback, useEffect, useMemo, useRef } from "react";
import { DrawStyle, Renderer, type Typeface } from "@tehreer/web";
import { useEngineObject } from "../lib/styledText";

const hex = (value: number) => value.toString(16).toUpperCase().padStart(4, "0");

const FIGURE_HEIGHT = 440;
const MIN_FIGURE_WIDTH = 400;
const ASCENT_Y = 70;
const DESCENT_LIMIT_Y = 380;
const LABEL_COLUMN = 80;
const SIDE_MARGIN = 70;
const LINE_COLOR = "#C9D6CC";

/** The ink box of a glyph, in font units, with the y axis down. */
interface InkBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Where everything of the figure goes. The labels of the guides sit in a column at the left and
 * the glyph starts to the right of it, so that no label touches the origin, the advance or the
 * ink. The figure grows with the glyph, and the dialog scrolls it when it is wider than the view.
 */
function layoutFigure(typeface: Typeface, glyphId: number, box: InkBox) {
  const upem = typeface.unitsPerEm;
  const unit = (DESCENT_LIMIT_Y - ASCENT_Y) / (typeface.ascent + typeface.descent);
  const advance = typeface.getGlyphAdvance(glyphId, upem) * unit;
  const inkLeft = box.x * unit;
  const inkRight = (box.x + box.width) * unit;
  const originX = Math.max(LABEL_COLUMN + 8, LABEL_COLUMN - inkLeft);
  const baselineY = ASCENT_Y + typeface.ascent * unit;
  return {
    unit,
    originX,
    advanceX: originX + advance,
    baselineY,
    descentY: baselineY + typeface.descent * unit,
    width: Math.ceil(Math.max(MIN_FIGURE_WIDTH, originX + Math.max(advance, inkRight) + SIDE_MARGIN)),
  };
}

type Figure = ReturnType<typeof layoutFigure>;

/** Draws the outline of a glyph against its ascent, baseline and descent, with its origin, advance and ink box. */
function drawFigure(context: CanvasRenderingContext2D, scale: number, typeface: Typeface, renderer: Renderer, glyphId: number, box: InkBox, figure: Figure) {
  const { unit, originX, advanceX, baselineY, descentY, width } = figure;

  context.setTransform(scale, 0, 0, scale, 0, 0);
  context.clearRect(0, 0, width, FIGURE_HEIGHT);
  const line = (x1: number, y1: number, x2: number, y2: number) => {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  };

  context.strokeStyle = LINE_COLOR;
  context.lineWidth = 1.5;
  line(originX, 20, originX, 420);
  line(advanceX, 20, advanceX, 420);
  context.setLineDash([6, 6]);
  line(0, ASCENT_Y, width, ASCENT_Y);
  line(0, descentY, width, descentY);
  context.setLineDash([]);
  context.strokeStyle = "#008700";
  context.lineWidth = 2;
  line(0, baselineY, width, baselineY);

  // The glyph is drawn by Tehreer, in device pixels.
  renderer.typeSize = typeface.unitsPerEm * unit;
  renderer.renderScale = scale;
  context.save();
  context.setTransform(1, 0, 0, 1, originX * scale, baselineY * scale);
  renderer.drawGlyphs(context, { glyphIds: [glyphId], glyphOffsets: [{ x: 0, y: 0 }], glyphAdvances: [0] });
  context.restore();

  // The ink box is dotted.
  if (box.width > 0 && box.height > 0) {
    context.strokeStyle = "#A8530C";
    context.lineWidth = 1.5;
    context.setLineDash([2, 3]);
    context.strokeRect(originX + box.x * unit, baselineY + box.y * unit, box.width * unit, box.height * unit);
    context.setLineDash([]);
  }

  context.beginPath();
  context.arc(originX, baselineY, 7, 0, Math.PI * 2);
  context.fillStyle = "#FFFFFF";
  context.fill();
  context.strokeStyle = "#111A14";
  context.lineWidth = 2;
  context.stroke();

  // The labels of the guides are in the column at the left, above their lines; the labels of the
  // origin and the advance are at the top, on the outer sides of their lines.
  context.font = "12px 'IBM Plex Mono', monospace";
  context.textBaseline = "alphabetic";
  context.textAlign = "start";
  context.fillStyle = "#3F4E44";
  context.fillText("ascent", 8, ASCENT_Y - 8);
  context.fillText("descent", 8, descentY - 8);
  context.fillStyle = "#008700";
  context.fillText("baseline", 8, baselineY - 8);
  context.fillStyle = "#3F4E44";
  context.textAlign = "end";
  context.fillText("origin", originX - 8, 36);
  context.textAlign = "start";
  context.fillText("advance", advanceX + 8, 36);
}

export function GlyphDialog({ typeface, glyphId, onSelect, onClose }: {
  typeface: Typeface;
  glyphId: number;
  onSelect: (glyphId: number) => void;
  onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const lastGlyph = typeface.glyphCount - 1;

  const renderer = useEngineObject(() => {
    const created = new Renderer();
    created.typeface = typeface;
    created.drawStyle = DrawStyle.FillStroke;
    created.foregroundColor = 0xffe3f4e3;
    created.strokeColor = 0xff111a14;
    created.strokeRadius = 1.25;
    return created;
  }, [typeface]);

  // The values of the table, in font units.
  const details = useMemo(() => {
    const measuring = new Renderer();
    try {
      measuring.typeface = typeface;
      measuring.typeSize = typeface.unitsPerEm;
      const box = measuring.computeGlyphInkBox(glyphId);
      const round = (value: number) => Math.round(value);
      return {
        advance: round(typeface.getGlyphAdvance(glyphId, typeface.unitsPerEm)),
        bounds: `${round(box.x)}, ${round(box.y)}, ${round(box.width)} × ${round(box.height)}`,
        box,
      };
    } finally {
      measuring.dispose();
    }
  }, [typeface, glyphId]);

  const figure = useMemo(() => layoutFigure(typeface, glyphId, details.box), [typeface, glyphId, details.box]);

  const draw = useCallback(() => {
    const element = canvas.current;
    if (element === null || renderer === undefined) {
      return;
    }
    const scale = window.devicePixelRatio || 1;
    element.width = Math.ceil(figure.width * scale);
    element.height = Math.ceil(FIGURE_HEIGHT * scale);
    drawFigure(element.getContext("2d")!, scale, typeface, renderer, glyphId, details.box, figure);
  }, [renderer, typeface, glyphId, details.box, figure]);

  useEffect(draw, [draw]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => opener?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      } else if (event.target instanceof HTMLElement && event.target.closest(".dialog-figure")) {
        // The arrow keys scroll the preview while it has the focus.
        return;
      } else if (event.key === "ArrowLeft" && glyphId > 0) {
        onSelect(glyphId - 1);
      } else if (event.key === "ArrowRight" && glyphId < lastGlyph) {
        onSelect(glyphId + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [glyphId, lastGlyph, onClose, onSelect]);

  const previous = Math.max(0, glyphId - 1);
  const next = Math.min(lastGlyph, glyphId + 1);

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="dlg-h" className="dialog">
        <div className="dialog-head">
          <div>
            <h2 id="dlg-h">Glyph <span>{hex(glyphId)}</span></h2>
            <p>{typeface.familyName ?? ""}</p>
          </div>
          <button ref={closeButton} type="button" className="icon-button square" aria-label="Close" onClick={onClose}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>

        <div className="dialog-body">
          <div className="dialog-figure" tabIndex={0} role="group" aria-label="Glyph preview, scrollable">
            <canvas
              ref={canvas}
              role="img"
              aria-label="Outline of the selected glyph with its dotted ink box, against the ascent, baseline and descent lines, with its origin and advance"
              style={{ width: figure.width, height: FIGURE_HEIGHT }}
            />
          </div>
          <dl>
            <div className="dl-row"><dt>Glyph ID</dt><dd className="mono-cell">{hex(glyphId)}</dd></div>
            <div className="dl-row"><dt>Advance</dt><dd className="mono-cell">{details.advance}</dd></div>
            <div className="dl-row"><dt>Bounds</dt><dd className="mono-cell">{details.bounds}</dd></div>
            <div className="dl-row"><dt>Ascent</dt><dd className="mono-cell">{typeface.ascent}</dd></div>
            <div className="dl-row"><dt>Descent</dt><dd className="mono-cell">{typeface.descent}</dd></div>
          </dl>
        </div>

        <div className="dialog-foot">
          <button type="button" className="icon-button" disabled={glyphId === 0} onClick={() => onSelect(previous)}>
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M11 3L5 9l6 6" /></svg>
            Glyph {hex(previous)}
          </button>
          <button type="button" className="icon-button" disabled={glyphId === lastGlyph} onClick={() => onSelect(next)}>
            Glyph {hex(next)}
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3l6 6-6 6" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
