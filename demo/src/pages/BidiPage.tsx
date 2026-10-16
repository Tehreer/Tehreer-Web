import { useMemo, useState } from "react";
import { BaseDirection, BidiAlgorithm, type BidiRun } from "tehreer";
import { PageHeader, WhenReady, useEngineReady } from "../components/Page";

type Direction = "auto" | "ltr" | "rtl";

interface Run {
  readonly start: number;
  readonly end: number;
  readonly level: number;
  readonly text: string;
}

interface Paragraph {
  readonly level: number;
  readonly logical: Run[];
  readonly visual: Run[];
}

const BASE_DIRECTIONS: Record<Direction, BaseDirection> = {
  auto: BaseDirection.DefaultLeftToRight,
  ltr: BaseDirection.LeftToRight,
  rtl: BaseDirection.RightToLeft,
};
const DEFAULT_TEXT = "The word مرحبا means hello";

/** Resolves the paragraphs of a text with the bidi algorithm, which gives the levels and runs of each line. */
function resolve(text: string, direction: Direction): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const algorithm = new BidiAlgorithm(text);
  try {
    let start = 0;
    while (start < text.length) {
      const end = algorithm.getParagraphBoundary(start, text.length);
      const paragraph = algorithm.createParagraph(start, end, BASE_DIRECTIONS[direction]);
      try {
        const line = paragraph.createLine(paragraph.startIndex, paragraph.endIndex);
        try {
          const toRun = (run: BidiRun): Run => ({
            start: run.startIndex,
            end: run.endIndex,
            level: run.embeddingLevel,
            text: text.slice(run.startIndex, run.endIndex),
          });
          paragraphs.push({
            level: paragraph.baseLevel,
            logical: [...paragraph.logicalRuns].map(toRun),
            visual: line.visualRuns.toArray().map(toRun),
          });
        } finally {
          line.dispose();
        }
        start = paragraph.endIndex;
      } finally {
        paragraph.dispose();
      }
    }
  } finally {
    algorithm.dispose();
  }
  return paragraphs;
}

const isRtl = (level: number) => level % 2 === 1;

export function BidiPage() {
  const engine = useEngineReady();
  const [text, setText] = useState(DEFAULT_TEXT);
  const [direction, setDirection] = useState<Direction>("auto");
  const [applied, setApplied] = useState({ text: DEFAULT_TEXT, direction: "auto" as Direction });
  const [problem, setProblem] = useState<string | undefined>();

  const apply = () => {
    if (text.length === 0) {
      setProblem("Please write something!");
    } else {
      setProblem(undefined);
      setApplied({ text, direction });
    }
  };

  const paragraphs = useMemo(
    () => (engine.ready ? resolve(applied.text, applied.direction) : undefined),
    [engine.ready, applied],
  );

  return (
    <>
      <PageHeader title="Bidirectional Algorithm" summary="Resolve embedding levels and visual runs of mixed-direction text." />

      <section aria-labelledby="in-h" className="card bidi-input">
        <div className="field">
          <label id="in-h" htmlFor="bidi-input" className="card-label">Input text</label>
          <textarea id="bidi-input" rows={2} className="bidi-text" value={text} onChange={(event) => setText(event.target.value)} />
        </div>
        <div className="bidi-controls">
          <div className="bidi-direction">
            <span id="dir-l" className="field-label">Paragraph direction</span>
            <div role="group" aria-labelledby="dir-l" className="segmented">
              {(["auto", "ltr", "rtl"] as const).map((value) => (
                <button key={value} type="button" aria-pressed={direction === value} onClick={() => setDirection(value)}>
                  {value === "auto" ? "Auto" : value.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button type="button" className="primary" onClick={apply}>Resolve</button>
        </div>
        {problem !== undefined && <p className="invalid" role="alert">{problem}</p>}
      </section>

      <WhenReady ready={paragraphs !== undefined} error={engine.error} what="the bidi algorithm">
        {paragraphs?.map((paragraph, index) => (
          <div className="row bidi-results" key={index}>
            <section aria-labelledby={`runs-h-${index}`} className="card runs-card">
              <div className="card-head">
                <h2 id={`runs-h-${index}`}>{paragraphs.length > 1 ? `Resolved runs · paragraph ${index + 1}` : "Resolved runs"}</h2>
                <span className="meta">
                  Base level {paragraph.level} · {isRtl(paragraph.level) ? "RTL" : "LTR"} · {paragraph.logical.length} run{paragraph.logical.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="table-scroll">
                <table className="runs-table">
                  <thead>
                    <tr><th scope="col">Range</th><th scope="col">Level</th><th scope="col">Direction</th><th scope="col">Text</th></tr>
                  </thead>
                  <tbody>
                    {paragraph.logical.map((run) => (
                      <tr key={run.start}>
                        <td className="mono-cell">{run.start} – {run.end - 1}</td>
                        <td className="mono-cell">{run.level}</td>
                        <td><span className={isRtl(run.level) ? "dir-rtl" : "dir-ltr"}>{isRtl(run.level) ? "RTL" : "LTR"}</span></td>
                        <td className="run-text" dir={isRtl(run.level) ? "rtl" : "ltr"} style={{ textAlign: "left" }}>{run.text.replace(/[\r\n\u2029]/g, "↵")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-labelledby={`vis-h-${index}`} className="card visual-card">
              <h2 id={`vis-h-${index}`}>Visual order</h2>
              <div className="visual-runs" dir="ltr">
                {paragraph.visual.map((run) => (
                  <span
                    key={run.start}
                    className={isRtl(run.level) ? "visual-run rtl" : "visual-run ltr"}
                    style={isRtl(run.level) ? { direction: "rtl", unicodeBidi: "isolate" } : undefined}
                  >
                    {run.text.replace(/[\r\n\u2029]/g, "")}
                  </span>
                ))}
              </div>
              <ul className="legend">
                <li><span aria-hidden="true" className="swatch ltr" />Level 0 · LTR</li>
                <li><span aria-hidden="true" className="swatch rtl" />Level 1 · RTL</li>
              </ul>
            </section>
          </div>
        ))}
      </WhenReady>
    </>
  );
}
