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
