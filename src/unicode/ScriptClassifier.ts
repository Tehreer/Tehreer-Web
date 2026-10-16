import type { UInt8 } from "../collections/NumberKind.js";
import { coreNumbers } from "../collections/CoreList.js";
import type { NumberList } from "../collections/List.js";
import { free, malloc, withUtf16 } from "../internal/Memory.js";
import { Module } from "../internal/Module.js";
import { NativeObject } from "../internal/NativeObject.js";
import { u8 } from "../internal/Struct.js";
import { SBScriptAgent } from "../internal/Structs.js";
import { checkRange } from "../internal/Validation.js";
import { withCodepointSequence } from "./BidiBuffer.js";
import type { Script } from "./enums.js";
import { ScriptRun } from "./ScriptRun.js";

/** Resolves the script of each character of a text. */
export class ScriptClassifier extends NativeObject {
  /** The text that the classifier was made for. */
  readonly text: string;

  constructor(text: string) {
    const length = text.length;
    const scripts = malloc(length);
    try {
      withUtf16(text, (units, count) =>
        withCodepointSequence(units, count, (sequence) => {
          const locator = Module._SBScriptLocatorCreate();
          try {
            Module._SBScriptLocatorLoadCodepoints(locator, sequence);
            const agent = Module._SBScriptLocatorGetAgent(locator);
            while (Module._SBScriptLocatorMoveNext(locator) !== 0) {
              const { offset, length: runLength, script } = SBScriptAgent.snapshot(agent);
              Module.HEAPU8.fill(script, scripts + offset, scripts + offset + runLength);
            }
          } finally {
            Module._SBScriptLocatorRelease(locator);
          }
        }),
      );
    } catch (error) {
      free(scripts);
      throw error;
    }

    super(scripts, free);
    this.text = text;
  }

  /** The resolved script of each character of the text, which is valid while the classifier is not disposed. */
  get charScripts(): NumberList<UInt8> {
    return coreNumbers(this, this.nativeHandle, this.text.length, u8);
  }

  /** The runs of the resolved scripts in the text. */
  get scriptRuns(): Iterable<ScriptRun> {
    return this.getScriptRuns(0, this.text.length);
  }

  /**
   * Returns the runs of the resolved scripts in a range of the text. The classifier must not be
   * disposed while they are iterated.
   *
   * @throws {RangeError} If the range is not inside of the text.
   */
  getScriptRuns(fromIndex: number, toIndex: number): Iterable<ScriptRun> {
    checkRange(fromIndex, toIndex, this.text.length);
    return { [Symbol.iterator]: () => this.#scriptRuns(fromIndex, toIndex) };
  }

  *#scriptRuns(fromIndex: number, toIndex: number): Generator<ScriptRun> {
    const scripts = this.charScripts;
    let index = fromIndex;
    while (index < toIndex) {
      const script = scripts.get(index);
      let next = index + 1;
      while (next < toIndex && scripts.get(next) === script) {
        next++;
      }
      yield new ScriptRun(index, next, script as Script);
      index = next;
    }
  }
}
