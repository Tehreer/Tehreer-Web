import { writeFile } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { DrawStyle, FrameResolver, Renderer, StrokeCap, StrokeJoin } from "tehreer";
import { z } from "zod";
import { checkAllowedPath, getTypeface } from "../registry.js";
import { texts, type ToolResult } from "../result.js";
import { characterList, colorString, parseColor, typefaceId } from "../schemas.js";
import { buildTypesetter, Scope, textSpecShape, type TextSpec } from "../textSpec.js";
import { configure, frameShape } from "./layout.js";

const MAX_PIXELS = 8_000;

const round = (value: number): number => Math.round(value * 1e3) / 1e3;
const DRAW_STYLES = { fill: DrawStyle.Fill, stroke: DrawStyle.Stroke, "fill-stroke": DrawStyle.FillStroke } as const;
const CAPS = { butt: StrokeCap.Butt, round: StrokeCap.Round, square: StrokeCap.Square } as const;
const JOINS = { round: StrokeJoin.Round, bevel: StrokeJoin.Bevel, miter: StrokeJoin.MiterVariable } as const;

const rendererShape = {
  renderScale: z.number().min(0.1).max(16).default(1).describe("Pixels per unit of the layout; the SVG is this much larger."),
  foregroundColor: colorString.default("#000000").describe("Color of the text where a span sets none."),
  drawStyle: z.enum(["fill", "stroke", "fill-stroke"]).default("fill"),
  strokeRadius: z.number().min(0).optional().describe("Half the stroke width, in layout units. Default 0.5."),
  strokeColor: colorString.optional(),
  strokeCap: z.enum(["butt", "round", "square"]).optional(),
  strokeJoin: z.enum(["round", "bevel", "miter"]).optional(),
  strokeMiter: z.number().min(1).optional(),
  shadow: z
    .object({
      radius: z.number().positive(),
      dx: z.number().default(0),
      dy: z.number().default(0),
      color: colorString.default("#00000080"),
    })
    .optional()
    .describe("Drop shadow behind the glyphs."),
};

const documentShape = {
  background: colorString.optional().describe("Fill for the whole image; transparent when omitted."),
  padding: z.number().min(0).max(1000).default(0).describe("Space around the content, in pixels."),
  outputPath: z
    .string()
    .optional()
    .describe("Absolute path of a .svg file to write on the machine running the server, besides returning the SVG."),
};

async function deliver(svg: string, metadata: Record<string, unknown>, outputPath: string | undefined): Promise<ToolResult> {
  if (outputPath !== undefined) {
    if (!isAbsolute(outputPath) || !outputPath.endsWith(".svg")) {
      throw new Error("outputPath must be an absolute path that ends in .svg.");
    }
    checkAllowedPath(outputPath, "TEHREER_MCP_OUTPUT_DIRS");
    await writeFile(outputPath, svg, "utf8");
    metadata.outputPath = outputPath;
  }
  return texts(JSON.stringify(metadata, null, 2), svg);
}

function wrap(width: number, height: number, padding: number, background: string | undefined, content: string): string {
  const w = round(width + 2 * padding);
  const h = round(height + 2 * padding);
  const fill = background === undefined ? "" : `<rect width="${w}" height="${h}" fill="${background.slice(0, 7)}"${background.length === 9 ? ` fill-opacity="${round(parseInt(background.slice(7), 16) / 255)}"` : ""}/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `${fill}<g transform="translate(${padding} ${padding})">${content}</g></svg>`
  );
}

function checkSize(width: number, height: number): void {
  if (!(width <= MAX_PIXELS && height <= MAX_PIXELS)) {
    throw new Error(`The image would be ${Math.round(width)}x${Math.round(height)} pixels; the limit is ${MAX_PIXELS}. Set a frame width or lower renderScale.`);
  }
}

export function registerRenderTools(server: McpServer): void {
  server.registerTool(
    "render_text",
    {
      title: "Render text to SVG",
      description:
        "Lays out attributed text (same inputs as layout_text) and draws it with Core as an SVG document: glyph " +
        "outlines, run backgrounds, underlines/strikethroughs, strokes and shadows. Without a frame width/height the " +
        "image fits the text. Replacements are not drawn, and glyphs that exist only as bitmaps (color emoji) are " +
        "left out. The first result item is JSON metadata, the second is the SVG. `debug` adds guides: line boxes, " +
        "baselines and ink boxes.",
      inputSchema: {
        ...textSpecShape,
        frame: z.object(frameShape).default({}),
        fromIndex: z.number().int().min(0).optional(),
        toIndex: z.number().int().min(0).optional(),
        ...rendererShape,
        ...documentShape,
        debug: z.array(z.enum(["lineBoxes", "baselines", "inkBoxes"])).optional(),
      },
    },
    async ({ frame: options, fromIndex, toIndex, renderScale, foregroundColor, drawStyle, strokeRadius, strokeColor, strokeCap, strokeJoin, strokeMiter, shadow, background, padding, outputPath, debug, ...spec }) => {
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
        configure(resolver, {
          fitsHorizontally: options.width === undefined,
          fitsVertically: options.height === undefined,
          ...options,
        });
        const frame = scope.add(resolver.createFrame(from, to));

        const renderer = scope.add(new Renderer());
        renderer.renderScale = renderScale;
        renderer.foregroundColor = parseColor(foregroundColor);
        renderer.drawStyle = DRAW_STYLES[drawStyle];
        if (strokeRadius !== undefined) renderer.strokeRadius = strokeRadius;
        if (strokeColor !== undefined) renderer.strokeColor = parseColor(strokeColor);
        if (strokeCap !== undefined) renderer.strokeCap = CAPS[strokeCap];
        if (strokeJoin !== undefined) renderer.strokeJoin = JOINS[strokeJoin];
        if (strokeMiter !== undefined) renderer.strokeMiter = strokeMiter;
        if (shadow) {
          renderer.shadowRadius = shadow.radius;
          renderer.shadowDx = shadow.dx;
          renderer.shadowDy = shadow.dy;
          renderer.shadowColor = parseColor(shadow.color);
        }

        const width = frame.width * renderScale;
        const height = frame.height * renderScale;
        checkSize(width + 2 * padding, height + 2 * padding);

        let content = frame.toSvg(renderer, 0, 0);
        if (debug?.length) {
          const guides: string[] = [];
          const lines = frame.lines;
          for (let i = 0; i < lines.length; i++) {
            const line = lines.get(i);
            try {
              const x = line.origin.x * renderScale;
              const y = line.origin.y * renderScale;
              if (debug.includes("lineBoxes")) {
                guides.push(`<rect x="${round(x)}" y="${round(y - line.ascent * renderScale)}" width="${round(line.width * renderScale)}" height="${round((line.ascent + line.descent) * renderScale)}" fill="none" stroke="#3b82f6" stroke-width="1"/>`);
              }
              if (debug.includes("baselines")) {
                guides.push(`<line x1="${round(x)}" y1="${round(y)}" x2="${round(x + line.width * renderScale)}" y2="${round(y)}" stroke="#ef4444" stroke-width="1"/>`);
              }
              if (debug.includes("inkBoxes")) {
                const ink = line.computeInkBox(renderer);
                guides.push(`<rect x="${round(x + ink.x * renderScale)}" y="${round(y + ink.y * renderScale)}" width="${round(ink.width * renderScale)}" height="${round(ink.height * renderScale)}" fill="none" stroke="#22c55e" stroke-width="1" stroke-dasharray="3 2"/>`);
              }
            } finally {
              line.dispose();
            }
          }
          content += `<g>${guides.join("")}</g>`;
        }

        const svg = wrap(width, height, padding, background, content);
        return await deliver(svg, { width: round(width + 2 * padding), height: round(height + 2 * padding), lineCount: frame.lines.length, renderScale }, outputPath);
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
      } finally {
        scope.dispose();
      }
    },
  );

  server.registerTool(
    "render_glyph",
    {
      title: "Render one glyph to SVG",
      description:
        "Draws a single glyph of a typeface as an SVG: its outline filled or stroked, optionally with metric guides " +
        "(baseline, ascent, descent, advance, ink box). Useful to look at a glyph, a variation instance or a " +
        "palette-less shape. Color and bitmap glyphs may come out empty.",
      inputSchema: {
        typefaceId,
        glyphId: z.number().int().min(0).optional().describe("Glyph id; give this or char."),
        char: z.string().optional().describe("A single character; give this or glyphId."),
        typeSize: z.number().positive().max(2000).default(200).describe("Size of the em square in pixels."),
        foregroundColor: colorString.default("#000000"),
        drawStyle: z.enum(["fill", "stroke"]).default("fill"),
        strokeWidth: z.number().positive().default(2).describe("Stroke width in pixels, for the stroke style."),
        guides: z.boolean().default(false).describe("Draw baseline, ascent, descent, advance and ink box."),
        ...documentShape,
      },
    },
    async ({ typefaceId: id, glyphId, char, typeSize, foregroundColor, drawStyle, strokeWidth, guides, background, padding, outputPath }) => {
      const scope = new Scope();
      try {
        const typeface = getTypeface(id);
        if ((glyphId === undefined) === (char === undefined)) {
          throw new Error("Give exactly one of glyphId or char.");
        }
        let glyph = glyphId;
        if (glyph === undefined) {
          const characters = characterList({ text: char });
          if (characters.length !== 1) {
            throw new Error("char must be exactly one character.");
          }
          glyph = typeface.getGlyphId(characters[0]!.codePoint);
        }

        const renderer = scope.add(new Renderer());
        renderer.typeface = typeface;
        renderer.typeSize = typeSize;
        const ink = renderer.computeGlyphInkBox(glyph);
        const advance = typeface.getGlyphAdvance(glyph, typeSize);
        const scale = typeSize / typeface.unitsPerEm;
        const ascent = typeface.ascent * scale;
        const descent = typeface.descent * scale;

        const left = Math.min(0, ink.x);
        const right = Math.max(advance, ink.x + ink.width);
        const top = Math.max(ascent, -ink.y);
        const bottom = Math.max(descent, ink.y + ink.height);
        const width = right - left;
        const height = top + bottom;
        checkSize(width + 2 * padding, height + 2 * padding);

        const path = typeface.getGlyphPath(glyph, typeSize);
        const color = parseColor(foregroundColor);
        const rgb = "#" + (color & 0xffffff).toString(16).padStart(6, "0");
        const opacity = (color >>> 24) === 255 ? "" : ` opacity="${round((color >>> 24) / 255)}"`;
        const empty = !path || path.isEmpty;
        const outline = empty
          ? ""
          : `<path d="${path.toSvgPathData()}" ` +
            (drawStyle === "fill" ? `fill="${rgb}"` : `fill="none" stroke="${rgb}" stroke-width="${strokeWidth}" stroke-linejoin="round"`) +
            `${opacity}/>`;

        let guideSvg = "";
        if (guides) {
          const line = (x1: number, y1: number, x2: number, y2: number, stroke: string) =>
            `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${stroke}" stroke-width="1"/>`;
          guideSvg =
            line(left, 0, right, 0, "#ef4444") +
            line(left, -ascent, right, -ascent, "#94a3b8") +
            line(left, descent, right, descent, "#94a3b8") +
            line(0, -top, 0, bottom, "#3b82f6") +
            line(advance, -top, advance, bottom, "#3b82f6") +
            `<rect x="${round(ink.x)}" y="${round(ink.y)}" width="${round(ink.width)}" height="${round(ink.height)}" fill="none" stroke="#22c55e" stroke-width="1" stroke-dasharray="3 2"/>`;
        }

        const content = `<g transform="translate(${round(-left)} ${round(top)})">${outline}${guideSvg}</g>`;
        const svg = wrap(width, height, padding, background, content);
        return await deliver(
          svg,
          {
            glyphId: glyph,
            glyphName: typeface.getGlyphName(glyph),
            empty,
            advance: round(advance),
            inkBox: { x: round(ink.x), y: round(ink.y), width: round(ink.width), height: round(ink.height) },
            width: round(width + 2 * padding),
            height: round(height + 2 * padding),
          },
          outputPath,
        );
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
      } finally {
        scope.dispose();
      }
    },
  );
}
