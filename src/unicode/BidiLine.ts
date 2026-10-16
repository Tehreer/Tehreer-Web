import { IndexedList } from "../collections/CoreList.js";
import type { List } from "../collections/List.js";
import { adopt } from "../internal/Adopt.js";
import { Module } from "../internal/Module.js";
import { NativeObject } from "../internal/NativeObject.js";
import { SBMirrorAgent, SBRun } from "../internal/Structs.js";
import { BidiBuffer } from "./BidiBuffer.js";
import { BidiPair } from "./BidiPair.js";
import { BidiRun } from "./BidiRun.js";

/** A line of a paragraph, processed with the rules L1 and L2 of the Unicode Bidirectional Algorithm. */
export class BidiLine extends NativeObject {
  readonly #buffer: BidiBuffer;

  /** @internal */
  constructor(token: typeof adopt, handle: number, buffer: BidiBuffer) {
    super(handle, (h) => {
      Module._SBLineRelease(h);
      buffer.release();
    });
    void token;
    this.#buffer = buffer;
  }

  /** @internal */
  static adopting(handle: number, buffer: BidiBuffer): BidiLine {
    return new BidiLine(adopt, handle, buffer);
  }

  /** The index of the first character of the line in the source text. */
  get startIndex(): number {
    return Module._SBLineGetOffset(this.nativeHandle);
  }

  /** The index after the last character of the line in the source text. */
  get endIndex(): number {
    const handle = this.nativeHandle;
    return Module._SBLineGetOffset(handle) + Module._SBLineGetLength(handle);
  }

  /** The runs of the line in their visual order, which are read when they are asked for. */
  get visualRuns(): List<BidiRun> {
    const handle = this.nativeHandle;
    const runs = Module._SBLineGetRunsPtr(handle);
    return new IndexedList(this, Module._SBLineGetRunCount(handle), (index) => {
      const run = SBRun.at(runs, index);
      return new BidiRun(run.offset, run.offset + run.length, run.level);
    });
  }

  /**
   * The characters of the line that have to be mirrored, in their logical order. They are the
   * means to implement the rule L4 of the Unicode Bidirectional Algorithm. The line must not be
   * disposed while they are iterated.
   */
  get mirroringPairs(): Iterable<BidiPair> {
    return { [Symbol.iterator]: () => this.#mirroringPairs() };
  }

  *#mirroringPairs(): Generator<BidiPair> {
    const line = this.nativeHandle;
    const locator = Module._SBMirrorLocatorCreate();
    try {
      Module._SBMirrorLocatorLoadLine(locator, line, this.#buffer.address);
      const agent = Module._SBMirrorLocatorGetAgent(locator);
      while (Module._SBMirrorLocatorMoveNext(locator) !== 0) {
        const { index, codepoint, mirror } = SBMirrorAgent.snapshot(agent);
        yield new BidiPair(index, codepoint, mirror);
        // The locator reads the line, which could have been disposed by the consumer.
        void this.nativeHandle;
      }
    } finally {
      Module._SBMirrorLocatorRelease(locator);
    }
  }
}
