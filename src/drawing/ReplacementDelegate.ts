import type { DrawingContext } from "./DrawingContext.js";

/** The room that a replacement takes in a line, in the user space. */
export interface ReplacementRoom {
  /** The distance from the baseline to the top. */
  readonly ascent: number;
  /** The distance from the baseline to the bottom. */
  readonly descent: number;
  /** The extent along the line. */
  readonly extent: number;
}

/** Where a replacement is drawn. Every distance is in pixels, which is the render scale applied. */
export interface ReplacementBounds {
  /** The start of the replacement on its baseline. */
  readonly x: number;
  readonly y: number;
  readonly ascent: number;
  readonly descent: number;
  readonly width: number;
}

/** What gives a replacement its size, and draws it. */
export interface ReplacementDelegate {
  /**
   * Computes the room of the replacement. It is called with a layout width of 0 while the text is
   * shaped, and with the width of the frame while the frame is laid out. A block replacement
   * usually takes the whole layout width as its extent.
   */
  computeRoom(layoutWidth: number): ReplacementRoom;

  /** Draws the replacement. Nothing is drawn if it is not there. */
  draw?(context: DrawingContext, bounds: ReplacementBounds): void;
}
