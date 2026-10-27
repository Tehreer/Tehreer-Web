import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BidiClass, CodePoint, GeneralCategory, Script, ScriptClassifier } from "tehreer";
import { z } from "zod";
import { guarded, hex } from "../result.js";
import { characterInput, characterList, enumName } from "../schemas.js";

export function registerUnicodeTools(server: McpServer): void {
  server.registerTool(
    "unicode_char_info",
    {
      title: "Unicode properties of characters",
      description:
        "Reports the bidi class, general category, script and mirror (if any) of each character. " +
        "`index` is the UTF-16 offset when text is given, otherwise the position in codePoints.",
      inputSchema: characterInput,
    },
    (input) =>
      guarded(() => ({
        characters: characterList(input).map(({ index, codePoint }) => {
          const mirror = CodePoint.getMirror(codePoint);
          return {
            index,
            char: String.fromCodePoint(codePoint),
            codePoint: hex(codePoint),
            bidiClass: enumName(BidiClass, CodePoint.getBidiClass(codePoint)),
            generalCategory: enumName(GeneralCategory, CodePoint.getGeneralCategory(codePoint)),
            script: enumName(Script, CodePoint.getScript(codePoint)),
            mirror: mirror === 0 ? undefined : { char: String.fromCodePoint(mirror), codePoint: hex(mirror) },
          };
        }),
      })),
  );

  server.registerTool(
    "unicode_script_runs",
    {
      title: "Split text into script runs",
      description:
        "Resolves the script of every character (common and inherited characters take the script of their context) " +
        "and returns the runs. Indices are UTF-16 code unit offsets.",
      inputSchema: {
        text: z.string().min(1).max(20_000).describe("Text to split."),
        fromIndex: z.number().int().min(0).optional().describe("Start of the range; default 0."),
        toIndex: z.number().int().min(0).optional().describe("End of the range (exclusive); default the text length."),
      },
    },
    ({ text, fromIndex, toIndex }) =>
      guarded(() => {
        const from = fromIndex ?? 0;
        const to = toIndex ?? text.length;
        if (from >= to || to > text.length) {
          throw new RangeError(`Invalid range ${from}..${to} for a text of ${text.length} code units.`);
        }
        const classifier = new ScriptClassifier(text);
        try {
          return {
            runs: [...classifier.getScriptRuns(from, to)].map((run) => ({
              start: run.startIndex,
              end: run.endIndex,
              text: text.slice(run.startIndex, run.endIndex),
              script: enumName(Script, run.script),
            })),
          };
        } finally {
          classifier.dispose();
        }
      }),
  );
}
