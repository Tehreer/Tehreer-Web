import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SfntTag, Typeface, TypefaceManager } from "tehreer";
import { z } from "zod";
import {
  addDerivedTypeface,
  derivedFromOf,
  findInstance,
  MAX_FONT_BYTES,
  releaseInstance,
  fontIdOf,
  getFont,
  getTypeface,
  idOfTypeface,
  listFonts,
  loadFont,
  typefaceIdsOfFont,
  unloadFont,
} from "../registry.js";
import { guarded, guardedAsync, hex } from "../result.js";
import {
  characterInput,
  characterList,
  colorString,
  formatColor,
  parseColor,
  parseSlope,
  parseTag,
  parseWeight,
  parseWidth,
  sfntTag,
  slopeInput,
  slopeName,
  typefaceId,
  weightInput,
  weightName,
  widthInput,
  widthName,
} from "../schemas.js";

const MAX_TABLE_BYTES = 64 * 1024;

function faceSummary(id: string, typeface: Typeface) {
  return {
    typefaceId: id,
    familyName: typeface.familyName,
    styleName: typeface.styleName,
    fullName: typeface.fullName,
    weight: typeface.weight,
    weightName: weightName(typeface.weight),
    width: widthName(typeface.width),
    slope: slopeName(typeface.slope),
    isVariable: typeface.isVariable,
    glyphCount: typeface.glyphCount,
    derivedFrom: derivedFromOf(id),
  };
}

function round(value: number): number {
  return Math.round(value * 1e4) / 1e4;
}

const INSPECT_SECTIONS = ["metrics", "names", "variation", "palettes", "bitmapStrikes"] as const;
type InspectSection = (typeof INSPECT_SECTIONS)[number];

function inspect(typeface: Typeface, sections: readonly InspectSection[]) {
  const result: Record<string, unknown> = {};
  for (const section of sections) {
    switch (section) {
      case "metrics":
        result.metrics = {
          unitsPerEm: typeface.unitsPerEm,
          ascent: typeface.ascent,
          descent: typeface.descent,
          leading: typeface.leading,
          glyphCount: typeface.glyphCount,
          boundingBox: typeface.boundingBox,
          underlinePosition: typeface.underlinePosition,
          underlineThickness: typeface.underlineThickness,
          strikeoutPosition: typeface.strikeoutPosition,
          strikeoutThickness: typeface.strikeoutThickness,
          isScalable: typeface.isScalable,
          isVariable: typeface.isVariable,
          weight: typeface.weight,
          width: widthName(typeface.width),
          slope: slopeName(typeface.slope),
        };
        break;
      case "names":
        result.names = {
          familyName: typeface.familyName,
          styleName: typeface.styleName,
          fullName: typeface.fullName,
        };
        break;
      case "variation":
        result.variation = {
          axes: typeface.variationAxes.map((axis) => ({
            tag: SfntTag.toString(axis.tag),
            name: axis.name,
            isHidden: axis.isHidden,
            min: axis.minValue,
            max: axis.maxValue,
            default: axis.defaultValue,
          })),
          coordinates: typeface.variationCoordinates.toArray(),
          namedStyles: typeface.namedStyles.map((style, index) => ({
            index,
            styleName: style.styleName,
            postScriptName: style.postScriptName,
            coordinates: style.coordinates.toArray(),
          })),
        };
        break;
      case "palettes":
        result.palettes = {
          entryNames: typeface.paletteEntryNames.toArray(),
          associatedColors: typeface.associatedColors.toArray().map(formatColor),
          predefined: typeface.predefinedPalettes.map((palette, index) => ({
            index,
            name: palette.name,
            flags: palette.flags,
            colors: palette.colors.toArray().map(formatColor),
          })),
        };
        break;
      case "bitmapStrikes":
        result.bitmapStrikes = typeface.bitmapStrikes.map((strike) => ({
          pixelWidth: strike.pixelWidth,
          pixelHeight: strike.pixelHeight,
        }));
        break;
    }
  }
  return result;
}

export function registerFontTools(server: McpServer): void {
  server.registerTool(
    "font_load",
    {
      title: "Load a font",
      description:
        "Loads a font file (TTF/OTF/TTC/OTC) from a local path, an http(s) URL or base64 data, and returns a " +
        "fontId plus one typefaceId per face. Typeface ids are what every other tool takes. Fonts stay loaded " +
        "until font_unload. Fonts are limited to 64 MB; prefer path or url over base64 for large ones. Local paths may be "
        + "restricted by TEHREER_MCP_FONT_DIRS, and URLs on private networks are refused.",
      inputSchema: {
        path: z.string().optional().describe("Absolute path of a font file on the machine running the server."),
        url: z.string().url().optional().describe("http(s) URL of a font file."),
        base64: z
          .string()
          .max(Math.ceil((MAX_FONT_BYTES * 4) / 3) + 4)
          .optional()
          .describe("Base64 encoded font file (at most 64 MB decoded)."),
        name: z.string().optional().describe("Label for the font; defaults to the file name."),
      },
    },
    ({ path, url, base64, name }) =>
      guardedAsync(async () => {
        const given = [path, url, base64].filter((value) => value !== undefined).length;
        if (given !== 1) {
          throw new Error("Give exactly one of path, url or base64.");
        }
        const source = path !== undefined ? { path } : url !== undefined ? { url } : { base64: base64! };
        const entry = await loadFont(source, name);
        return {
          fontId: entry.fontId,
          name: entry.name,
          faces: entry.faceIds.map((id) => faceSummary(id, getTypeface(id))),
        };
      }),
  );

  server.registerTool(
    "font_list",
    {
      title: "List loaded fonts",
      description: "Lists the loaded fonts with their faces (including instances made by font_instance) and the font families that are registered.",
      inputSchema: {},
    },
    () =>
      guarded(() => ({
        fonts: listFonts().map((entry) => ({
          fontId: entry.fontId,
          name: entry.name,
          origin: entry.origin,
          faces: typefaceIdsOfFont(entry.fontId).map((id) => faceSummary(id, getTypeface(id))),
        })),
        families: TypefaceManager.getAvailableFamilies().map((family) => family.familyName),
      })),
  );

  server.registerTool(
    "font_unload",
    {
      title: "Unload a font",
      description: "Unloads a font and invalidates all of its typeface ids, instances included.",
      inputSchema: { fontId: z.string().describe("Id returned by font_load.") },
    },
    ({ fontId }) =>
      guarded(() => {
        getFont(fontId);
        unloadFont(fontId);
        return { unloaded: fontId };
      }),
  );

  server.registerTool(
    "font_inspect",
    {
      title: "Inspect a typeface",
      description:
        "Reports metrics (in font units; divide by unitsPerEm for em), names, variation axes and named styles, " +
        "color palettes, and bitmap strikes. Defaults to metrics and names.",
      inputSchema: {
        typefaceId,
        include: z
          .array(z.enum(INSPECT_SECTIONS))
          .optional()
          .describe("Sections to report. Default: metrics and names."),
      },
    },
    ({ typefaceId: id, include }) =>
      guarded(() => {
        const typeface = getTypeface(id);
        return { ...faceSummary(id, typeface), ...inspect(typeface, include ?? ["metrics", "names"]) };
      }),
  );

  server.registerTool(
    "font_instance",
    {
      title: "Make a variation or color instance",
      description:
        "Makes a new typeface from a variable and/or color font. For variation give axis values by tag (axes you " +
        "leave out stay at their default) or a named style; for color give a predefined palette index or explicit " +
        "colors for the palette entries. Values are clamped to their axes. Returns a new typefaceId (the same one if the request was made before).",
      inputSchema: {
        typefaceId,
        axes: z.record(z.string(), z.number()).optional().describe("Axis values by tag, e.g. {\"wght\": 700, \"wdth\": 80}."),
        namedStyle: z
          .union([z.string(), z.number().int().min(0)])
          .optional()
          .describe("Named style, by style name or index into namedStyles (see font_inspect with 'variation')."),
        palette: z.number().int().min(0).optional().describe("Index of a predefined color palette."),
        colors: z.array(colorString).optional().describe("Colors for the palette entries, in order."),
      },
    },
    ({ typefaceId: id, axes, namedStyle, palette, colors }) =>
      guarded(() => {
        const base = getTypeface(id);
        const wantsVariation = axes !== undefined || namedStyle !== undefined;
        const wantsColor = palette !== undefined || colors !== undefined;
        if (!wantsVariation && !wantsColor) {
          throw new Error("Give axes, namedStyle, palette or colors.");
        }
        if (axes !== undefined && namedStyle !== undefined) {
          throw new Error("Give either axes or namedStyle, not both.");
        }
        if (palette !== undefined && colors !== undefined) {
          throw new Error("Give either palette or colors, not both.");
        }

        let current = base;
        const made: Typeface[] = [];
        try {
          if (wantsVariation) {
            let coordinates: number[];
            if (namedStyle !== undefined) {
              const styles = current.namedStyles.toArray();
              const style = typeof namedStyle === "number" ? styles[namedStyle] : styles.find((s) => s.styleName === namedStyle);
              if (!style) {
                throw new RangeError(`No such named style: ${namedStyle}`);
              }
              coordinates = style.coordinates.toArray();
            } else {
              const tags = new Map(current.variationAxes.map((axis) => [SfntTag.toString(axis.tag).trimEnd(), axis] as const));
              for (const key of Object.keys(axes!)) {
                if (!tags.has(key.trimEnd())) {
                  throw new RangeError(`The typeface has no axis "${key}" (axes: ${[...tags.keys()].join(", ") || "none"}).`);
                }
              }
              coordinates = current.variationAxes.map((axis) => {
                const key = SfntTag.toString(axis.tag).trimEnd();
                const given = Object.entries(axes!).find(([name]) => name.trimEnd() === key);
                return given ? given[1] : axis.defaultValue;
              });
            }
            const varied = current.getVariationInstance(coordinates);
            if (!varied) {
              throw new Error("The typeface has no variation axes.");
            }
            made.push(varied);
            current = varied;
          }
          if (wantsColor) {
            let paletteColors: number[];
            if (palette !== undefined) {
              const entry = current.predefinedPalettes.at(palette);
              if (!entry) {
                throw new RangeError(`No such palette: ${palette}`);
              }
              paletteColors = entry.colors.toArray();
            } else {
              paletteColors = colors!.map(parseColor);
            }
            const colored = current.getColorInstance(paletteColors);
            if (!colored) {
              throw new Error("The typeface has no palette entries.");
            }
            made.push(colored);
            current = colored;
          }
        } catch (error) {
          for (const typeface of made) {
            typeface.dispose();
          }
          throw error;
        }

        // Only the last instance is kept; intermediate ones are released.
        for (const typeface of made.slice(0, -1)) {
          typeface.dispose();
        }
        // The same request gives the same typeface, so repeating it does not use up the registry.
        const key = JSON.stringify([current.variationCoordinates.toArray(), current.associatedColors.toArray()]);
        const existing = findInstance(id, key);
        if (existing !== undefined) {
          current.dispose();
          return { ...faceSummary(existing, getTypeface(existing)), reused: true };
        }
        const newId = addDerivedTypeface(id, current, key);
        return faceSummary(newId, current);
      }),
  );

  server.registerTool(
    "font_release",
    {
      title: "Release an instance",
      description:
        "Frees a typeface made by font_instance (and instances made from it) without unloading its font. " +
        "Use it to keep a long session under the typeface limit. Faces of a font file are freed by font_unload.",
      inputSchema: { typefaceId },
    },
    ({ typefaceId: id }) => guarded(() => ({ released: releaseInstance(id) })),
  );

  server.registerTool(
    "font_glyphs",
    {
      title: "Map characters to glyphs",
      description:
        "Looks up the glyph of each character (no shaping, so no ligatures or contextual forms; use shape_text for " +
        "that). Glyph 0 is the missing glyph. Advances are in font units unless typeSize is given.",
      inputSchema: {
        typefaceId,
        ...characterInput,
        variantSelector: z
          .number()
          .int()
          .min(0xfe00)
          .max(0xe01ef)
          .optional()
          .describe("Variation selector code point (U+FE00..U+FE0F, U+E0100..U+E01EF) applied to every character."),
        typeSize: z.number().positive().optional().describe("Size of the em square for advances. Default: unitsPerEm."),
        vertical: z.boolean().optional().describe("Report vertical advances."),
      },
    },
    ({ typefaceId: id, variantSelector, typeSize, vertical, ...characters }) =>
      guarded(() => {
        const typeface = getTypeface(id);
        const size = typeSize ?? typeface.unitsPerEm;
        return {
          typeSize: size,
          glyphs: characterList(characters).map(({ index, codePoint }) => {
            const glyphId =
              variantSelector !== undefined
                ? typeface.getVariantGlyphId(codePoint, variantSelector)
                : typeface.getGlyphId(codePoint);
            return {
              index,
              char: String.fromCodePoint(codePoint),
              codePoint: hex(codePoint),
              glyphId,
              glyphName: glyphId === 0 ? undefined : typeface.getGlyphName(glyphId),
              advance: round(typeface.getGlyphAdvance(glyphId, size, vertical ?? false)),
            };
          }),
        };
      }),
  );

  server.registerTool(
    "font_outline",
    {
      title: "Get a glyph outline",
      description:
        "Returns the outline of a glyph at a size, as SVG path data or as path commands. The origin is the pen " +
        "position on the baseline and the y axis points down. Color and bitmap glyphs may have no outline.",
      inputSchema: {
        typefaceId,
        glyphId: z.number().int().min(0).optional().describe("Glyph id; give this or char."),
        char: z.string().optional().describe("A single character; give this or glyphId."),
        typeSize: z.number().positive().optional().describe("Size of the em square. Default: unitsPerEm."),
        transform: z
          .object({ a: z.number(), b: z.number(), c: z.number(), d: z.number(), tx: z.number(), ty: z.number() })
          .optional()
          .describe("Affine transform applied to the outline."),
        format: z.enum(["svg", "commands"]).default("svg"),
      },
    },
    ({ typefaceId: id, glyphId, char, typeSize, transform, format }) =>
      guarded(() => {
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
        const size = typeSize ?? typeface.unitsPerEm;
        const path = typeface.getGlyphPath(glyph, size, transform);
        if (!path || path.isEmpty) {
          return { glyphId: glyph, typeSize: size, empty: true };
        }
        const base = { glyphId: glyph, glyphName: typeface.getGlyphName(glyph), typeSize: size, empty: false };
        if (format === "svg") {
          return { ...base, svgPath: path.toSvgPathData() };
        }
        const names = ["M", "L", "Q", "C", "Z"];
        const counts = [2, 2, 4, 6, 0];
        const commands: [string, ...number[]][] = [];
        let offset = 0;
        for (const verb of path.verbs) {
          const count = counts[verb]!;
          commands.push([names[verb]!, ...path.coordinates.slice(offset, offset + count)]);
          offset += count;
        }
        return { ...base, commands };
      }),
  );

  server.registerTool(
    "font_table",
    {
      title: "Read an sfnt table",
      description: `Returns the size of an sfnt table and up to ${MAX_TABLE_BYTES} bytes of it, hex or base64 encoded.`,
      inputSchema: {
        typefaceId,
        tag: sfntTag,
        offset: z.number().int().min(0).default(0),
        length: z.number().int().min(0).max(MAX_TABLE_BYTES).default(256).describe("Bytes to read; 0 reports only the size."),
        encoding: z.enum(["hex", "base64"]).default("hex"),
      },
    },
    ({ typefaceId: id, tag, offset, length, encoding }) =>
      guarded(() => {
        const typeface = getTypeface(id);
        const sfnt = parseTag(tag);
        const size = typeface.getTableSize(sfnt);
        if (size === 0) {
          return { tag: SfntTag.toString(sfnt), exists: false };
        }
        const available = Math.max(0, Math.min(length, size - offset));
        const bytes = available === 0 ? new Uint8Array() : typeface.getTableData(sfnt, offset, available) ?? new Uint8Array();
        return {
          tag: SfntTag.toString(sfnt),
          exists: true,
          size,
          offset,
          length: bytes.length,
          encoding,
          data: Buffer.from(bytes).toString(encoding),
        };
      }),
  );

  server.registerTool(
    "font_match",
    {
      title: "Match a registered typeface by style",
      description:
        "Finds the loaded typeface closest to a family name and style using Core's style matching, or by exact " +
        "full name. Loaded fonts are registered automatically.",
      inputSchema: {
        family: z.string().optional().describe("Family name (case-insensitive)."),
        weight: weightInput.optional(),
        width: widthInput.optional(),
        slope: slopeInput.optional(),
        fullName: z.string().optional().describe("Exact full name; use instead of family."),
      },
    },
    ({ family, weight, width, slope, fullName }) =>
      guarded(() => {
        if ((family === undefined) === (fullName === undefined)) {
          throw new Error("Give exactly one of family or fullName.");
        }
        let match: Typeface | undefined;
        if (fullName !== undefined) {
          match = TypefaceManager.getTypefaceByName(fullName);
        } else {
          const w = parseWeight(weight);
          const wd = parseWidth(width);
          const s = parseSlope(slope);
          match = TypefaceManager.getTypeFamily(family!)?.getTypefaceByStyle(wd, w, s) ?? TypefaceManager.getTypefaceByStyle(family!, wd, w, s);
        }
        if (!match) {
          return { found: false };
        }
        try {
          const id = idOfTypeface(match);
          return { found: true, ...(id ? faceSummary(id, match) : { typefaceId: undefined }), fontId: id ? fontIdOf(id) : undefined };
        } finally {
          match.dispose();
        }
      }),
  );
}
