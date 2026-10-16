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

import { useLayoutEffect, useRef } from "react";

/** A canvas of a size in CSS pixels that is drawn at the pixel ratio of the screen. */
export function GlyphCanvas({ width, height, label, draw }: {
  width: number;
  height: number;
  label?: string;
  /** Draws into the context. Positions that go to Tehreer are in CSS pixels, scaled by `scale` for the context. */
  draw: (context: CanvasRenderingContext2D, scale: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const element = canvas.current;
    if (element === null || width <= 0 || height <= 0) {
      return;
    }
    const scale = window.devicePixelRatio || 1;
    element.width = Math.ceil(width * scale);
    element.height = Math.ceil(height * scale);
    draw(element.getContext("2d")!, scale);
  }, [width, height, draw]);

  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label={label}
      style={{ display: "block", width, height }}
    />
  );
}
