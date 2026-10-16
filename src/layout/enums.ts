/** Where a line may break when the text does not fit. */
export enum BreakMode {
  /** A line breaks at the opportunities that Unicode gives. */
  Line = 0,
  /** A line breaks at any character. */
  Character = 1,
}

/** Which part of a line is replaced with the token when it is truncated. */
export enum TruncationPlace {
  Start = 0,
  Middle = 1,
  End = 2,
}

/** The alignment of the lines of a paragraph. Leading and trailing follow its base direction. */
export enum TextAlignment {
  Left = 0,
  Center = 1,
  Right = 2,
  /** The edge where the paragraph starts: left for left-to-right text, right otherwise. */
  Leading = 3,
  /** The edge where the paragraph ends. */
  Trailing = 4,
}

/** Where the lines go when a frame is taller than they are. */
export enum VerticalAlignment {
  Top = 0,
  Center = 1,
  Bottom = 2,
}

/** How a replacement is placed in the text. */
export enum ReplacementKind {
  /** It stays on the line of the text around it. */
  Inline = 0,
  /** It has a line of its own. */
  Block = 1,
}
