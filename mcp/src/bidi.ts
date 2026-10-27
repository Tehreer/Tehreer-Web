import {
  BaseDirection,
  BidiAlgorithm,
  BidiClass,
  type BidiRun,
} from "tehreer";

/** Base direction choices exposed to the tools. */
export type Base = "auto" | "auto-rtl" | "ltr" | "rtl";

const BASE_DIRECTIONS: Record<Base, BaseDirection> = {
  auto: BaseDirection.DefaultLeftToRight, // first strong character, LTR if none
  "auto-rtl": BaseDirection.DefaultRightToLeft, // first strong character, RTL if none
  ltr: BaseDirection.LeftToRight,
  rtl: BaseDirection.RightToLeft,
};

/** A run of characters with one embedding level. Indices are UTF-16 code unit offsets. */
export interface RunInfo {
  start: number;
  end: number;
  text: string;
  level: number;
  direction: "ltr" | "rtl";
}

export interface MirroredChar {
  index: number;
  char: string;
  mirror: string;
}

export interface ParagraphInfo {
  start: number;
  end: number;
  baseLevel: number;
  baseDirection: "ltr" | "rtl";
  /** Runs in logical (memory) order. */
  logicalRuns: RunInfo[];
  /** Runs in left-to-right display order. */
  visualRuns: RunInfo[];
  /** Characters swapped for their mirror image inside right-to-left runs (rule L4). */
  mirroredChars: MirroredChar[];
  /** The paragraph as it would be displayed left to right, with mirroring applied. */
  visualText: string;
}

export interface Analysis {
  paragraphs: ParagraphInfo[];
  /** Final embedding level of every UTF-16 code unit, after rule L1. */
  levels: number[];
  /** Bidi class name of every UTF-16 code unit. */
  classes: string[];
}

const className = (value: number): string => BidiClass[value] ?? `Unknown(${value})`;

function toRunInfo(text: string, run: BidiRun): RunInfo {
  return {
    start: run.startIndex,
    end: run.endIndex,
    text: text.slice(run.startIndex, run.endIndex),
    level: run.embeddingLevel,
    direction: run.isRightToLeft ? "rtl" : "ltr",
  };
}

function renderRun(text: string, run: BidiRun, mirrors: Map<number, number>): string {
  const codePoints: number[] = [];
  for (let i = run.startIndex; i < run.endIndex; ) {
    const cp = text.codePointAt(i)!;
    codePoints.push(run.isRightToLeft ? (mirrors.get(i) ?? cp) : cp);
    i += cp > 0xffff ? 2 : 1;
  }
  if (run.isRightToLeft) codePoints.reverse();
  return codePoints.map((cp) => String.fromCodePoint(cp)).join("");
}

/** Runs the Unicode Bidirectional Algorithm (UAX #9) over every paragraph of `text`. */
export function analyze(text: string, base: Base): Analysis {
  const algorithm = new BidiAlgorithm(text); // throws RangeError on empty text
  try {
    const classValues = algorithm.charBidiClasses.toArray();
    const levels: number[] = new Array<number>(text.length).fill(0);
    const paragraphs: ParagraphInfo[] = [];

    let from = 0;
    while (from < text.length) {
      const to = algorithm.getParagraphBoundary(from, text.length);
      const paragraph = algorithm.createParagraph(from, to, BASE_DIRECTIONS[base]);
      try {
        const baseLevel = paragraph.baseLevel;
        levels.fill(baseLevel, paragraph.startIndex, paragraph.endIndex);

        // The paragraph separator is not part of any displayed line.
        let contentEnd = paragraph.endIndex;
        while (contentEnd > paragraph.startIndex && classValues[contentEnd - 1] === BidiClass.ParagraphSeparator) {
          contentEnd--;
        }

        const info: ParagraphInfo = {
          start: paragraph.startIndex,
          end: paragraph.endIndex,
          baseLevel,
          baseDirection: baseLevel % 2 === 1 ? "rtl" : "ltr",
          logicalRuns: [],
          visualRuns: [],
          mirroredChars: [],
          visualText: "",
        };

        if (contentEnd > paragraph.startIndex) {
          const line = paragraph.createLine(paragraph.startIndex, contentEnd);
          try {
            const visual = line.visualRuns.toArray();
            for (const run of visual) levels.fill(run.embeddingLevel, run.startIndex, run.endIndex);

            const mirrors = new Map<number, number>();
            for (const pair of line.mirroringPairs) {
              mirrors.set(pair.charIndex, pair.pairingCodePoint);
              info.mirroredChars.push({
                index: pair.charIndex,
                char: String.fromCodePoint(pair.actualCodePoint),
                mirror: String.fromCodePoint(pair.pairingCodePoint),
              });
            }

            info.visualRuns = visual.map((run) => toRunInfo(text, run));
            info.logicalRuns = [...visual].sort((a, b) => a.startIndex - b.startIndex).map((run) => toRunInfo(text, run));
            info.visualText = visual.map((run) => renderRun(text, run, mirrors)).join("");
          } finally {
            line.dispose();
          }
        }

        paragraphs.push(info);
        from = paragraph.endIndex;
      } finally {
        paragraph.dispose();
      }
    }

    return { paragraphs, levels, classes: classValues.map(className) };
  } finally {
    algorithm.dispose();
  }
}
