import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getVersion } from "@tehreer/web";
import { z } from "zod";
import { analyze, type Analysis } from "../bidi.js";
import { guarded, hex } from "../result.js";

const inputShape = {
  text: z
    .string()
    .min(1)
    .max(20_000)
    .describe("Text to analyze, in logical (typing) order. May contain several paragraphs."),
  baseDirection: z
    .enum(["auto", "auto-rtl", "ltr", "rtl"])
    .default("auto")
    .describe(
      "Paragraph base direction. 'auto' follows the first strong character (LTR if none), " +
        "'auto-rtl' is the same but falls back to RTL, 'ltr' and 'rtl' force the direction.",
    ),
};

function characterTable(text: string, analysis: Analysis) {
  const rows: { index: number; char: string; codePoint: string; bidiClass: string; level: number }[] = [];
  for (let i = 0; i < text.length; ) {
    const cp = text.codePointAt(i)!;
    rows.push({
      index: i,
      char: String.fromCodePoint(cp),
      codePoint: hex(cp),
      bidiClass: analysis.classes[i] ?? "Unknown",
      level: analysis.levels[i] ?? 0,
    });
    i += cp > 0xffff ? 2 : 1;
  }
  return rows;
}

export function registerBidiTools(server: McpServer): void {
  server.registerTool(
    "bidi_analyze",
    {
      title: "Analyze bidirectional text",
      description:
        "Runs the Unicode Bidirectional Algorithm (UAX #9) with Tehreer. Per paragraph it returns the base " +
        "level, runs in logical order, runs in visual (left-to-right display) order, mirrored characters " +
        "and the display-ordered string. All indices are UTF-16 code unit offsets into the input.",
      inputSchema: inputShape,
    },
    ({ text, baseDirection }) =>
      guarded(() => {
        const { paragraphs } = analyze(text, baseDirection);
        return { tehreerVersion: getVersion(), paragraphs };
      }),
  );
  
  server.registerTool(
    "bidi_levels",
    {
      title: "Per-character bidi classes and levels",
      description:
        "Lists every character with its code point, original bidi class (L, R, AL, EN, WS, ...) and final " +
        "embedding level. Useful to explain why a character ends up in a given run.",
      inputSchema: inputShape,
    },
    ({ text, baseDirection }) =>
      guarded(() => {
        const analysis = analyze(text, baseDirection);
        return {
          paragraphs: analysis.paragraphs.map((p) => ({ start: p.start, end: p.end, baseLevel: p.baseLevel })),
          characters: characterTable(text, analysis),
        };
      }),
  );
  
  server.registerTool(
    "bidi_visual_order",
    {
      title: "Logical to visual order",
      description:
        "Returns, per paragraph, the runs in left-to-right display order and the reordered string " +
        "(right-to-left runs reversed, mirrored characters such as parentheses swapped).",
      inputSchema: inputShape,
    },
    ({ text, baseDirection }) =>
      guarded(() => ({
        paragraphs: analyze(text, baseDirection).paragraphs.map((p) => ({
          start: p.start,
          end: p.end,
          baseDirection: p.baseDirection,
          visualRuns: p.visualRuns,
          visualText: p.visualText,
        })),
      })),
  );
  }
