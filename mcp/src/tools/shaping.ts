import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Renderer, Script, ScriptClassifier, SfntTag, ShapingEngine, ShapingOrder, WritingDirection } from "@tehreer/web";
import { z } from "zod";
import { getTypeface } from "../registry.js";
import { guarded } from "../result.js";
import { enumName, parseTag, sfntTag, typefaceId } from "../schemas.js";

const MAX_SHAPED_CHARACTERS = 5_000;
const COMMON_SCRIPTS = new Set<number>([Script.Common, Script.Inherited, Script.Unknown]);

const round = (value: number): number => Math.round(value * 1e4) / 1e4;
const tagName = (tag: number): string => SfntTag.toString(tag).trimEnd();
const directionName = (direction: WritingDirection): "ltr" | "rtl" =>
  direction === WritingDirection.RightToLeft ? "rtl" : "ltr";

/** The OpenType script tag of the first character that has a script of its own. */
function detectScript(text: string): { tag: number; script: string; scriptCount: number } {
  const classifier = new ScriptClassifier(text);
  try {
    const scripts = new Set<number>();
    for (const run of classifier.scriptRuns) {
      if (!COMMON_SCRIPTS.has(run.script)) {
        scripts.add(run.script);
      }
    }
    const first = scripts.values().next();
    if (first.done) {
      return { tag: SfntTag.make("DFLT"), script: "Common", scriptCount: 0 };
    }
    return { tag: Script.getOpenTypeTag(first.value), script: enumName(Script, first.value), scriptCount: scripts.size };
  } finally {
    classifier.dispose();
  }
}

export function registerShapingTools(server: McpServer): void {
  server.registerTool(
    "shape_text",
    {
      title: "Shape text into glyphs",
      description:
        "Shapes a text with one typeface and one set of settings (ligatures, contextual forms, kerning, mark " +
        "positioning, OpenType features) and returns the glyphs. `cluster` is the UTF-16 index (in the full text) " +
        "of the characters a glyph came from; several glyphs can share one cluster, and one glyph can cover " +
        "several characters. Glyph offsets and advances are in the units of typeSize (default unitsPerEm = font " +
        "units); y points down. Shape one script and one direction at a time: use unicode_script_runs and " +
        "bidi_analyze to split mixed text first.",
      inputSchema: {
        typefaceId,
        text: z.string().min(1).max(MAX_SHAPED_CHARACTERS),
        fromIndex: z.number().int().min(0).optional().describe("Start of the range to shape; default 0."),
        toIndex: z.number().int().min(0).optional().describe("End of the range (exclusive); default the text length."),
        typeSize: z.number().positive().optional().describe("Size of the em square. Default: unitsPerEm."),
        script: sfntTag.optional().describe("OpenType script tag ('arab', 'latn', 'dev2'). Default: detected from the text."),
        language: z.string().optional().describe("BCP 47 language ('ur', 'sd-Arab'); selects language-specific features. Default: none."),
        direction: z
          .enum(["ltr", "rtl"])
          .optional()
          .describe("Writing direction. Default: the default direction of the script."),
        order: z
          .enum(["forward", "backward"])
          .optional()
          .describe("Order of the glyphs: 'forward' follows the text, 'backward' reverses it. Default forward."),
        features: z
          .array(z.object({ tag: sfntTag, value: z.number().int().min(0).default(1) }))
          .max(64)
          .optional()
          .describe("OpenType features, e.g. [{tag:'liga',value:0}] to turn ligatures off, [{tag:'ss01'}] to turn a set on."),
        detail: z
          .enum(["glyphs", "summary"])
          .default("glyphs")
          .describe("'summary' leaves out the per-glyph list and the caret edges."),
      },
    },
    ({ typefaceId: id, text, fromIndex, toIndex, typeSize, script, language, direction, order, features, detail }) =>
      guarded(() => {
        const typeface = getTypeface(id);
        const from = fromIndex ?? 0;
        const to = toIndex ?? text.length;
        if (from >= to || to > text.length) {
          throw new RangeError(`Invalid range ${from}..${to} for a text of ${text.length} code units.`);
        }
        const size = typeSize ?? typeface.unitsPerEm;

        const detected = script === undefined ? detectScript(text.slice(from, to)) : undefined;
        const scriptTag = script !== undefined ? parseTag(script) : detected!.tag;
        const writingDirection =
          direction === undefined
            ? ShapingEngine.getScriptDefaultDirection(scriptTag)
            : direction === "rtl"
              ? WritingDirection.RightToLeft
              : WritingDirection.LeftToRight;

        const engine = new ShapingEngine();
        const renderer = new Renderer();
        try {
          engine.typeface = typeface;
          engine.typeSize = size;
          engine.scriptTag = scriptTag;
          if (language !== undefined) {
            engine.languageTag = ShapingEngine.getLanguageTag(language);
          }
          engine.writingDirection = writingDirection;
          engine.shapingOrder = order === "backward" ? ShapingOrder.Backward : ShapingOrder.Forward;
          if (features) {
            engine.openTypeFeatures = features.map((feature) => ({ tag: parseTag(feature.tag), value: feature.value }));
          }

          const result = engine.shapeText(text, from, to);
          try {
            renderer.typeface = typeface;
            renderer.typeSize = size;
            const glyphIds = result.glyphIds.toArray();
            const offsets = result.glyphOffsets.toArray();
            const advances = result.glyphAdvances.toArray();
            const clusters = result.clusterMap.toArray();
            const inkBox = renderer.computeRunInkBox(result);
            const width = advances.reduce((sum, advance) => sum + advance, 0);

            const summary = {
              typeSize: size,
              fromIndex: from,
              toIndex: to,
              scriptTag: tagName(scriptTag),
              detectedScript: detected?.script,
              scriptCount: detected?.scriptCount,
              languageTag: language === undefined ? undefined : tagName(engine.languageTag),
              direction: directionName(writingDirection),
              isRTL: result.isRTL,
              isBackward: result.isBackward,
              glyphCount: result.glyphCount,
              width: round(width),
              inkBox: { x: round(inkBox.x), y: round(inkBox.y), width: round(inkBox.width), height: round(inkBox.height) },
              warning:
                detected && detected.scriptCount > 1
                  ? "The text has several scripts; only the first was used. Split it with unicode_script_runs."
                  : undefined,
            };
            if (detail === "summary") {
              return summary;
            }
            return {
              ...summary,
              glyphs: glyphIds.map((glyphId, index) => ({
                glyphId,
                name: typeface.getGlyphName(glyphId),
                cluster: from + clusters[index]!,
                advance: round(advances[index]!),
                offsetX: round(offsets[index]!.x),
                offsetY: round(offsets[index]!.y),
              })),
              // Distance from the start of the run to each code unit boundary, along the writing direction.
              caretEdges: Array.from(result.getCaretEdges(), round),
            };
          } finally {
            result.dispose();
          }
        } finally {
          renderer.dispose();
          engine.dispose();
        }
      }),
  );

  server.registerTool(
    "shaping_lookup",
    {
      title: "Look up OpenType script and language tags",
      description:
        "Converts a BCP 47 language ('ur', 'ur-PK') to its OpenType language tag, tells the default writing " +
        "direction of an OpenType script tag, and detects the OpenType script tags used by a text.",
      inputSchema: {
        language: z.string().optional().describe("BCP 47 language tag."),
        scriptTag: sfntTag.optional().describe("OpenType script tag, e.g. 'arab'."),
        text: z.string().max(20_000).optional().describe("Text whose scripts are detected."),
      },
    },
    ({ language, scriptTag, text }) =>
      guarded(() => {
        if (language === undefined && scriptTag === undefined && text === undefined) {
          throw new Error("Give language, scriptTag or text.");
        }
        const result: Record<string, unknown> = {};
        if (language !== undefined) {
          result.language = { input: language, languageTag: tagName(ShapingEngine.getLanguageTag(language)) };
        }
        if (scriptTag !== undefined) {
          const tag = parseTag(scriptTag);
          result.script = {
            scriptTag: tagName(tag),
            defaultDirection: directionName(ShapingEngine.getScriptDefaultDirection(tag)),
          };
        }
        if (text !== undefined) {
          const classifier = new ScriptClassifier(text);
          try {
            result.scriptRuns = [...classifier.scriptRuns].map((run) => ({
              start: run.startIndex,
              end: run.endIndex,
              script: enumName(Script, run.script),
              scriptTag: COMMON_SCRIPTS.has(run.script) ? undefined : tagName(Script.getOpenTypeTag(run.script)),
            }));
          } finally {
            classifier.dispose();
          }
        }
        return result;
      }),
  );
}
