import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  BreakMode,
  type ComposedFrame,
  type ComposedLine,
  FrameResolver,
  type GlyphRun,
  LineLocator,
  Renderer,
  TruncationPlace,
  VerticalAlignment,
  WritingDirection,
} from "@tehreer/web";
import { z } from "zod";
import { idOfTypeface } from "../registry.js";
import { guarded } from "../result.js";
import { formatColor } from "../schemas.js";
import { buildTypesetter, parseAlignment, Scope, TEXT_ALIGNMENTS, textSpecShape, type TextSpec } from "../textSpec.js";

const MAX_LINES_REPORTED = 500;
const MAX_BREAKS = 5_000;

const round = (value: number): number => Math.round(value * 1e4) / 1e4;
const rect = (r: { x: number; y: number; width: number; height: number }) => ({
  x: round(r.x),
  y: round(r.y),
  width: round(r.width),
  height: round(r.height),
});
const point = (p: { x: number; y: number }) => ({ x: round(p.x), y: round(p.y) });

const BREAK_MODES = { line: BreakMode.Line, character: BreakMode.Character } as const;
const PLACES = { start: TruncationPlace.Start, middle: TruncationPlace.Middle, end: TruncationPlace.End } as const;
const VERTICAL = { top: VerticalAlignment.Top, center: VerticalAlignment.Center, bottom: VerticalAlignment.Bottom } as const;

export const frameShape = {
  width: z.number().min(0).optional().describe("Frame width; omit for unbounded (no wrapping; the reported frame width is then huge unless fitsHorizontally is set, so use line widths)."),
  height: z.number().min(0).optional().describe("Frame height; omit for unbounded."),
  fitsHorizontally: z.boolean().optional().describe("Shrink the frame width to the widest line."),
  fitsVertically: z.boolean().optional().describe("Shrink the frame height to its lines."),
  textAlignment: z.enum(TEXT_ALIGNMENTS).optional().describe("Default alignment; a paragraph attribute overrides it. Default leading."),
  verticalAlignment: z.enum(["top", "center", "bottom"]).optional(),
  maxLines: z.number().int().min(1).optional(),
  isTruncationEnabled: z.boolean().optional().describe("Truncate the last line with a token when text does not fit."),
  truncationMode: z.enum(["line", "character"]).optional(),
  truncationPlace: z.enum(["start", "middle", "end"]).optional(),
  isJustificationEnabled: z.boolean().optional(),
  justificationLevel: z.number().min(0).max(1).optional(),
  extraLineSpacing: z.number().optional(),
  lineHeightMultiplier: z.number().positive().optional(),
};
export type FrameOptions = { [K in keyof typeof frameShape]?: z.infer<(typeof frameShape)[K]> };

export function configure(resolver: FrameResolver, f: FrameOptions): void {
  if (f.width !== undefined) resolver.frameWidth = f.width;
  if (f.height !== undefined) resolver.frameHeight = f.height;
  if (f.fitsHorizontally !== undefined) resolver.fitsHorizontally = f.fitsHorizontally;
  if (f.fitsVertically !== undefined) resolver.fitsVertically = f.fitsVertically;
  if (f.textAlignment !== undefined) resolver.textAlignment = parseAlignment(f.textAlignment);
  if (f.verticalAlignment !== undefined) resolver.verticalAlignment = VERTICAL[f.verticalAlignment];
  if (f.maxLines !== undefined) resolver.maxLines = f.maxLines;
  if (f.isTruncationEnabled !== undefined) resolver.isTruncationEnabled = f.isTruncationEnabled;
  if (f.truncationMode !== undefined) resolver.truncationMode = BREAK_MODES[f.truncationMode];
  if (f.truncationPlace !== undefined) resolver.truncationPlace = PLACES[f.truncationPlace];
  if (f.isJustificationEnabled !== undefined) resolver.isJustificationEnabled = f.isJustificationEnabled;
  if (f.justificationLevel !== undefined) resolver.justificationLevel = f.justificationLevel;
  if (f.extraLineSpacing !== undefined) resolver.extraLineSpacing = f.extraLineSpacing;
  if (f.lineHeightMultiplier !== undefined) resolver.lineHeightMultiplier = f.lineHeightMultiplier;
}

function runInfo(run: GlyphRun, glyphs: boolean) {
  const typeface = run.typeface;
  let typefaceId: string | undefined;
  try {
    typefaceId = typeface ? idOfTypeface(typeface) : undefined;
  } finally {
    typeface?.dispose();
  }
  const foreground = run.foregroundColor;
  const background = run.backgroundColor;
  const decoration = run.decorationColor;
  const replacement = run.replacement;
  try {
    return {
      startIndex: run.startIndex,
      endIndex: run.endIndex,
      bidiLevel: run.bidiLevel,
      direction: run.writingDirection === WritingDirection.RightToLeft ? "rtl" : "ltr",
      isBackward: run.isBackward,
      typefaceId,
      typeSize: run.typeSize,
      scaleX: run.scaleX,
      scaleY: run.scaleY,
      foregroundColor: foreground === undefined ? undefined : formatColor(foreground),
      backgroundColor: background === undefined ? undefined : formatColor(background),
      decorationColor: decoration === undefined ? undefined : formatColor(decoration),
      underline: run.hasUnderline || undefined,
      strikethrough: run.hasStrikethrough || undefined,
      isReplacement: replacement !== undefined || undefined,
      userData: run.userData || undefined,
      ascent: round(run.ascent),
      descent: round(run.descent),
      leading: round(run.leading),
      origin: point(run.origin),
      width: round(run.width),
      height: round(run.height),
      glyphCount: run.glyphCount,
      ...(glyphs
        ? {
            glyphIds: run.glyphIds.toArray(),
            glyphOffsets: run.glyphOffsets.toArray().map(point),
            glyphAdvances: run.glyphAdvances.toArray().map(round),
            clusterMap: run.clusterMap.toArray(),
          }
        : {}),
    };
  } finally {
    replacement?.dispose();
  }
}

function lineInfo(line: ComposedLine, index: number, text: string, detail: "lines" | "runs" | "glyphs") {
  return {
    index,
    startIndex: line.startIndex,
    endIndex: line.endIndex,
    text: text.slice(line.startIndex, line.endIndex),
    origin: point(line.origin),
    ascent: round(line.ascent),
    descent: round(line.descent),
    leading: round(line.leading),
    width: round(line.width),
    height: round(line.height),
    trailingWhitespaceExtent: round(line.trailingWhitespaceExtent),
    paragraphLevel: line.paragraphLevel,
    isTruncated: line.isTruncated || undefined,
    isBlock: line.isBlock || undefined,
    runs:
      detail === "lines"
        ? undefined
        : line.runs.map((run) => {
            try {
              return runInfo(run, detail === "glyphs");
            } finally {
              run.dispose();
            }
          }),
  };
}

const lineIndex = z.number().int().min(0).describe("Line index into the frame's lines.");
const queryShape = z.discriminatedUnion("type", [
  z.object({ type: z.literal("selectionRects"), fromIndex: z.number().int().min(0), toIndex: z.number().int().min(0) }),
  z.object({ type: z.literal("lineForIndex"), index: z.number().int().min(0) }),
  z.object({ type: z.literal("lineAtPosition"), x: z.number(), y: z.number() }),
  z.object({ type: z.literal("hitTest"), x: z.number(), y: z.number() }).describe("Line at y, then the nearest character boundary at x (frame coordinates)."),
  z.object({ type: z.literal("distanceForIndex"), line: lineIndex, index: z.number().int().min(0) }),
  z.object({ type: z.literal("indexAtDistance"), line: lineIndex, distance: z.number() }),
  z.object({ type: z.literal("visualEdges"), line: lineIndex, fromIndex: z.number().int().min(0), toIndex: z.number().int().min(0) }),
  z.object({ type: z.literal("lineBox"), line: lineIndex }),
  z.object({ type: z.literal("linesInRect"), x: z.number(), y: z.number(), width: z.number().min(0), height: z.number().min(0) }),
]);
type Query = z.infer<typeof queryShape>;

function withLine<T>(frame: ComposedFrame, line: number, body: (line: ComposedLine) => T): T {
  const lines = frame.lines;
  if (line >= lines.length) {
    throw new RangeError(`Line ${line} does not exist; the frame has ${lines.length} lines.`);
  }
  const found = lines.get(line);
  try {
    return body(found);
  } finally {
    found.dispose();
  }
}

function answer(query: Query, frame: ComposedFrame, locator: () => LineLocator): unknown {
  switch (query.type) {
    case "selectionRects":
      return { rects: frame.getSelectionRects(query.fromIndex, query.toIndex).map(rect) };
    case "lineForIndex": {
      const found = frame.getLineIndexForCodeUnit(query.index);
      return { line: found < 0 ? undefined : found };
    }
    case "lineAtPosition":
      return { line: frame.getLineIndexAtPosition(query.x, query.y) };
    case "hitTest": {
      const lineNumber = frame.getLineIndexAtPosition(query.x, query.y);
      if (lineNumber < 0) return { line: undefined };
      return withLine(frame, lineNumber, (line) => ({
        line: lineNumber,
        index: line.getCodeUnitIndexAtDistance(query.x - line.origin.x),
      }));
    }
    case "distanceForIndex":
      return withLine(frame, query.line, (line) => ({ distance: round(line.getCodeUnitDistance(query.index)) }));
    case "indexAtDistance":
      return withLine(frame, query.line, (line) => ({ index: line.getCodeUnitIndexAtDistance(query.distance) }));
    case "visualEdges":
      return withLine(frame, query.line, (line) => ({
        edges: line.getVisualEdges(query.fromIndex, query.toIndex).map((edge) => ({ left: round(edge.left), right: round(edge.right) })),
      }));
    case "lineBox":
      withLine(frame, query.line, () => undefined);
      return { box: rect(locator().getLineBox(query.line)) };
    case "linesInRect":
      return { lines: locator().findLines({ x: query.x, y: query.y, width: query.width, height: query.height }) };
  }
}

export function registerLayoutTools(server: McpServer): void {
  server.registerTool(
    "layout_text",
    {
      title: "Lay out text in a frame",
      description:
        "Lays out attributed text with Core's typesetter (shaping, bidi, line breaking, alignment, truncation, " +
        "justification) and reports the frame, its lines and optionally runs and glyphs. The frame's top left is " +
        "(0,0) and y points down; line origins are in frame coordinates. Attributes name fonts by typefaceId. " +
        "`queries` answers geometry questions about the result (selection rectangles, hit testing, caret " +
        "distances, visual edges, line boxes); results come back in the same order. All indices are UTF-16 offsets.",
      inputSchema: {
        ...textSpecShape,
        frame: z.object(frameShape).default({}).describe("Frame and line settings."),
        fromIndex: z.number().int().min(0).optional().describe("First character to lay out; default 0."),
        toIndex: z.number().int().min(0).optional().describe("End of the range (exclusive); default the text length."),
        detail: z.enum(["lines", "runs", "glyphs"]).default("lines").describe("How much to report per line."),
        queries: z.array(queryShape).max(200).optional(),
      },
    },
    ({ frame: options, fromIndex, toIndex, detail, queries, ...spec }) =>
      guarded(() => {
        const scope = new Scope();
        try {
          const { typesetter } = buildTypesetter(spec as TextSpec, scope);
          const from = fromIndex ?? 0;
          const to = toIndex ?? spec.text.length;
          if (from >= to || to > spec.text.length) {
            throw new RangeError(`Invalid range ${from}..${to} for a text of ${spec.text.length} code units.`);
          }
          const resolver = scope.add(new FrameResolver());
          resolver.typesetter = typesetter;
          configure(resolver, options);
          const frame = scope.add(resolver.createFrame(from, to));

          const lines = frame.lines;
          const reported = Math.min(lines.length, MAX_LINES_REPORTED);
          const result: Record<string, unknown> = {
            startIndex: frame.startIndex,
            endIndex: frame.endIndex,
            width: round(frame.width),
            height: round(frame.height),
            lineCount: lines.length,
            lines: Array.from({ length: reported }, (_, i) => withLine(frame, i, (line) => lineInfo(line, i, spec.text, detail))),
            note: reported < lines.length ? `Only the first ${reported} lines are reported.` : undefined,
          };

          if (queries) {
            let locator: LineLocator | undefined;
            const getLocator = () => (locator ??= scope.add(new LineLocator(frame, scope.add(new Renderer()))));
            result.queries = queries.map((query, i) => {
              try {
                return { query: i, type: query.type, ...(answer(query, frame, getLocator) as object) };
              } catch (error) {
                return { query: i, type: query.type, error: error instanceof Error ? error.message : String(error) };
              }
            });
          }
          return result;
        } finally {
          scope.dispose();
        }
      }),
  );

  server.registerTool(
    "layout_break_lines",
    {
      title: "Suggest line breaks",
      description:
        "Finds where text can be broken so a line fits an extent, without building a frame. With `all` it breaks " +
        "the whole range into successive lines (forward from the start, or backward from the end). Returns " +
        "break indices (UTF-16). Break mode 'line' follows Unicode line-break opportunities, 'character' breaks anywhere.",
      inputSchema: {
        ...textSpecShape,
        fromIndex: z.number().int().min(0).optional().describe("Start of the range; default 0."),
        toIndex: z.number().int().min(0).optional().describe("End of the range (exclusive); default the text length."),
        extent: z.number().positive().describe("Available width of a line."),
        breakMode: z.enum(["line", "character"]).default("line"),
        direction: z.enum(["forward", "backward"]).default("forward").describe("Search from the start or from the end of the range."),
        all: z.boolean().default(false).describe("Break the whole range into lines instead of finding one break."),
      },
    },
    ({ fromIndex, toIndex, extent, breakMode, direction, all, ...spec }) =>
      guarded(() => {
        const scope = new Scope();
        try {
          const { typesetter } = buildTypesetter(spec as TextSpec, scope);
          const from = fromIndex ?? 0;
          const to = toIndex ?? spec.text.length;
          if (from >= to || to > spec.text.length) {
            throw new RangeError(`Invalid range ${from}..${to} for a text of ${spec.text.length} code units.`);
          }
          const mode = BREAK_MODES[breakMode];
          const suggest = (a: number, b: number) =>
            direction === "forward" ? typesetter.suggestForwardBreak(a, b, extent, mode) : typesetter.suggestBackwardBreak(a, b, extent, mode);

          if (!all) {
            const index = suggest(from, to);
            return { breakIndex: index, text: spec.text.slice(...(direction === "forward" ? [from, index] : [index, to])) };
          }

          const lines: { fromIndex: number; toIndex: number; text: string }[] = [];
          let a = from;
          let b = to;
          while (a < b) {
            if (lines.length >= MAX_BREAKS) {
              throw new Error(`More than ${MAX_BREAKS} lines; use a smaller range.`);
            }
            const index = suggest(a, b);
            if (direction === "forward") {
              lines.push({ fromIndex: a, toIndex: index, text: spec.text.slice(a, index) });
              a = index;
            } else {
              lines.unshift({ fromIndex: index, toIndex: b, text: spec.text.slice(index, b) });
              b = index;
            }
          }
          return { lineCount: lines.length, lines };
        } finally {
          scope.dispose();
        }
      }),
  );
}
