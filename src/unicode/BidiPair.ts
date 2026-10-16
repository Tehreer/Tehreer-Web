/** A character that has to be replaced by its mirror when it is drawn in a right-to-left run. */
export class BidiPair {
  constructor(
    /** The index of the character in the source text. */
    readonly charIndex: number,
    /** The code point of the character in the source text. */
    readonly actualCodePoint: number,
    /** The code point of the character that forms a pair with it, which is its mirror. */
    readonly pairingCodePoint: number,
  ) {}

  equals(other: BidiPair): boolean {
    return (
      this.charIndex === other.charIndex &&
      this.actualCodePoint === other.actualCodePoint &&
      this.pairingCodePoint === other.pairingCodePoint
    );
  }

  toString(): string {
    return `BidiPair{charIndex=${this.charIndex}, actualCodePoint=${this.actualCodePoint}, pairingCodePoint=${this.pairingCodePoint}}`;
  }
}
