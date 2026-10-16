/** Receives the contours of an outline, in the order that they are made. */
export interface PathSink {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  quadTo(controlX: number, controlY: number, x: number, y: number): void;
  cubicTo(control1X: number, control1Y: number, control2X: number, control2Y: number, x: number, y: number): void;
  close(): void;
}
