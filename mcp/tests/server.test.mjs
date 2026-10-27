// Starts the built server over stdio and exercises the font, unicode and bidi tools.
// Fixtures are Core's fonts; set TEHREER_CORE if Core is not checked out next to this repository.
import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const server = fileURLToPath(new URL("../build/server.js", import.meta.url));
const core = process.env.TEHREER_CORE ?? fileURLToPath(new URL("../../../Tehreer-Core", import.meta.url));
const font = (name) => join(core, "Tests/Fonts", name);

let client;
before(async () => {
  client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [server], stderr: "ignore" }));
});
after(() => client.close());

async function call(name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content[0].text;
  return result.isError ? { error: text } : JSON.parse(text);
}

test("lists every tool", async () => {
  const names = (await client.listTools()).tools.map((t) => t.name);
  for (const name of ["font_load", "font_inspect", "font_instance", "font_glyphs", "font_outline", "font_table",
    "font_match", "font_list", "font_unload", "unicode_char_info", "unicode_script_runs", "shape_text", "shaping_lookup", "layout_text", "layout_break_lines", "render_text", "render_glyph", "bidi_analyze"]) {
    assert.ok(names.includes(name), name);
  }
});

test("font tools on Roboto", async () => {
  const loaded = await call("font_load", { path: font("Roboto-Regular.abc.ttf") });
  assert.equal(loaded.faces.length, 1);
  const id = loaded.faces[0].typefaceId;
  assert.equal(loaded.faces[0].familyName, "Roboto");

  const info = await call("font_inspect", { typefaceId: id, include: ["metrics", "names"] });
  assert.equal(info.metrics.unitsPerEm, 2048);

  const glyphs = await call("font_glyphs", { typefaceId: id, text: "aZا" });
  assert.equal(glyphs.glyphs.length, 3);
  assert.ok(glyphs.glyphs[0].glyphId > 0);
  assert.equal(glyphs.glyphs[2].glyphId, 0);

  const outline = await call("font_outline", { typefaceId: id, char: "a", typeSize: 100 });
  assert.match(outline.svgPath, /^M/);
  const commands = await call("font_outline", { typefaceId: id, char: "a", format: "commands" });
  assert.equal(commands.commands[0][0], "M");

  const head = await call("font_table", { typefaceId: id, tag: "head", length: 8 });
  assert.equal(head.length, 8);
  assert.equal((await call("font_table", { typefaceId: id, tag: "zzzz" })).exists, false);

  const match = await call("font_match", { family: "roboto", weight: "bold" });
  assert.equal(match.typefaceId, id);

  assert.ok((await call("font_list")).fonts.some((f) => f.fontId === loaded.fontId));
  assert.ok((await call("font_unload", { fontId: loaded.fontId })).unloaded);
  assert.match((await call("font_inspect", { typefaceId: id })).error, /Unknown typefaceId/);
});

test("variable and base64 fonts", async () => {
  const bytes = readFileSync(font("Roboto-Variable.abc.ttf"));
  const loaded = await call("font_load", { base64: bytes.toString("base64"), name: "var" });
  assert.equal(loaded.name, "var");
  const id = loaded.faces[0].typefaceId;
  const variation = (await call("font_inspect", { typefaceId: id, include: ["variation"] })).variation;
  assert.ok(variation.axes.some((a) => a.tag.trim() === "wght"));

  const bold = await call("font_instance", { typefaceId: id, axes: { wght: 700 } });
  assert.equal(bold.derivedFrom, id);
  assert.ok((await call("font_instance", { typefaceId: id, axes: { nope: 1 } })).error);
  assert.ok((await call("font_instance", { typefaceId: id })).error);
  await call("font_unload", { fontId: loaded.fontId });
});

test("color palettes", async () => {
  const loaded = await call("font_load", { path: font("RocherColorGX.abc.ttf") });
  const id = loaded.faces[0].typefaceId;
  const palettes = (await call("font_inspect", { typefaceId: id, include: ["palettes"] })).palettes;
  assert.ok(palettes.predefined.length > 0);
  const colored = await call("font_instance", { typefaceId: id, palette: 0 });
  assert.ok(colored.typefaceId);
  await call("font_unload", { fontId: loaded.fontId });
});

test("rejects bad font sources", async () => {
  assert.match((await call("font_load", {})).error, /exactly one/);
  assert.ok((await call("font_load", { path: "/nonexistent.ttf" })).error);
  assert.ok((await call("font_load", { base64: Buffer.from("not a font").toString("base64") })).error);
});

test("unicode tools", async () => {
  const info = await call("unicode_char_info", { text: "a(ا" });
  assert.equal(info.characters[0].script, "Latin");
  assert.equal(info.characters[1].mirror.char, ")");
  assert.equal(info.characters[2].bidiClass, "RightToLeftArabic");
  assert.equal((await call("unicode_char_info", { codePoints: [0x1f600] })).characters[0].codePoint, "U+1F600");
  assert.ok((await call("unicode_char_info", { text: "a", codePoints: [1] })).error);

  const runs = await call("unicode_script_runs", { text: "abc ال" });
  assert.deepEqual(runs.runs.map((r) => r.script), ["Latin", "Arabic"]);
  assert.ok((await call("unicode_script_runs", { text: "abc", fromIndex: 2, toIndex: 1 })).error);
});

test("bidi tools still work", async () => {
  const result = await call("bidi_visual_order", { text: "abc ال" });
  assert.equal(result.paragraphs.length, 1);
});

test("shape_text", async () => {
  const roboto = (await call("font_load", { path: font("Roboto-Regular.abc.ttf") })).faces[0].typefaceId;
  const latin = await call("shape_text", { typefaceId: roboto, text: "abc" });
  assert.equal(latin.scriptTag, "latn");
  assert.equal(latin.direction, "ltr");
  assert.equal(latin.glyphCount, 3);
  assert.deepEqual(latin.glyphs.map((g) => g.cluster), [0, 1, 2]);
  assert.equal(latin.caretEdges.length, 4);
  assert.ok(Math.abs(latin.width - latin.glyphs.reduce((s, g) => s + g.advance, 0)) < 0.01);
  assert.ok(latin.inkBox.width > 0);

  const sized = await call("shape_text", { typefaceId: roboto, text: "abc", typeSize: 200 });
  assert.ok(Math.abs(sized.width / latin.width - 200 / 2048) < 0.001);

  const range = await call("shape_text", { typefaceId: roboto, text: "xabcx", fromIndex: 1, toIndex: 4, detail: "summary" });
  assert.equal(range.glyphCount, 3);
  assert.equal(range.glyphs, undefined);
  assert.deepEqual((await call("shape_text", { typefaceId: roboto, text: "xabcx", fromIndex: 1, toIndex: 4 })).glyphs.map((g) => g.cluster), [1, 2, 3]);

  const featured = await call("shape_text", { typefaceId: roboto, text: "abc", language: "en", features: [{ tag: "kern", value: 0 }] });
  assert.equal(featured.languageTag, "ENG");

  assert.match((await call("shape_text", { typefaceId: roboto, text: "abc", fromIndex: 2, toIndex: 2 })).error, /Invalid range/);
  assert.ok((await call("shape_text", { typefaceId: "t999", text: "abc" })).error);
  const mixed = await call("shape_text", { typefaceId: roboto, text: "abc ال", detail: "summary" });
  assert.match(mixed.warning, /several scripts/);
});

test("shape_text with Urdu in a Nastaliq font", async () => {
  const nastaliq = (await call("font_load", { path: font("NotoNastaliqUrdu-Regular.ttf") })).faces[0].typefaceId;
  const urdu = await call("shape_text", { typefaceId: nastaliq, text: "اردو", language: "ur" });
  assert.equal(urdu.scriptTag, "arab");
  assert.equal(urdu.direction, "rtl");
  assert.equal(urdu.isRTL, true);
  assert.ok(urdu.glyphCount > 0);
  const forced = await call("shape_text", { typefaceId: nastaliq, text: "اردو", direction: "ltr", detail: "summary" });
  assert.equal(forced.direction, "ltr");
});

test("shaping_lookup", async () => {
  const result = await call("shaping_lookup", { language: "ur", scriptTag: "arab", text: "abc ا" });
  assert.equal(result.language.languageTag, "URD");
  assert.equal(result.script.defaultDirection, "rtl");
  assert.equal(result.scriptRuns[0].scriptTag, "latn");
  assert.equal(result.scriptRuns.at(-1).scriptTag, "arab");
  assert.ok((await call("shaping_lookup", {})).error);
});

async function loadRoboto() {
  return (await call("font_load", { path: font("Roboto-Regular.abc.ttf") })).faces[0].typefaceId;
}

test("layout_text wraps lines and answers queries", async () => {
  const roboto = await loadRoboto();
  const text = "aaa bbb ccc aaa";
  const single = await call("layout_text", { text, defaults: { typefaceId: roboto, typeSize: 20 } });
  assert.equal(single.lineCount, 1);
  const wrapped = await call("layout_text", {
    text,
    defaults: { typefaceId: roboto, typeSize: 20 },
    frame: { width: single.lines[0].width / 2 },
    detail: "glyphs",
    queries: [
      { type: "selectionRects", fromIndex: 0, toIndex: 3 },
      { type: "lineForIndex", index: 9 },
      { type: "hitTest", x: 1, y: 1 },
      { type: "distanceForIndex", line: 0, index: 3 },
      { type: "indexAtDistance", line: 0, distance: 0 },
      { type: "visualEdges", line: 0, fromIndex: 0, toIndex: 3 },
      { type: "lineBox", line: 0 },
      { type: "linesInRect", x: 0, y: 0, width: 1000, height: 1000 },
      { type: "distanceForIndex", line: 99, index: 0 },
    ],
  });
  assert.ok(wrapped.lineCount > 1);
  assert.equal(wrapped.lines[0].text.startsWith("aaa"), true);
  assert.equal(wrapped.lines[0].runs[0].typefaceId, roboto);
  assert.ok(wrapped.lines[0].runs[0].glyphIds.length > 0);
  const [rects, lineFor, hit, distance, at, edges, box, inRect, bad] = wrapped.queries;
  assert.ok(rects.rects.length >= 1 && rects.rects[0].width > 0);
  assert.ok(lineFor.line >= 0);
  assert.deepEqual([hit.line, hit.index], [0, 0]);
  assert.ok(distance.distance > 0);
  assert.equal(at.index, 0);
  assert.equal(edges.edges.length, 1);
  assert.ok(box.box.width > 0);
  assert.ok(inRect.lines.length >= 1);
  assert.match(bad.error, /does not exist/);
});

test("layout_text spans, alignment, truncation and replacements", async () => {
  const roboto = await loadRoboto();
  const spans = await call("layout_text", {
    text: "abcabc",
    defaults: { typefaceId: roboto, typeSize: 20 },
    spans: [{ fromIndex: 3, toIndex: 6, attributes: { typeSize: 40, foregroundColor: "#FF0000", underline: true } }],
    detail: "runs",
  });
  const runs = spans.lines[0].runs;
  assert.equal(runs.length, 2);
  assert.equal(runs[1].typeSize, 40);
  assert.equal(runs[1].foregroundColor, "#FF0000");
  assert.equal(runs[1].underline, true);

  const left = await call("layout_text", { text: "abc", defaults: { typefaceId: roboto, typeSize: 20 }, frame: { width: 500, textAlignment: "left" } });
  const right = await call("layout_text", { text: "abc", defaults: { typefaceId: roboto, typeSize: 20 }, frame: { width: 500, textAlignment: "right" } });
  assert.ok(right.lines[0].origin.x > left.lines[0].origin.x);

  const cut = await call("layout_text", {
    text: "abcabcabcabc",
    defaults: { typefaceId: roboto, typeSize: 20 },
    frame: { width: 60, maxLines: 1, isTruncationEnabled: true, truncationMode: "character" },
  });
  assert.equal(cut.lineCount, 1);
  assert.equal(cut.lines[0].isTruncated, true);

  const replaced = await call("layout_text", {
    text: "a￼b",
    defaults: { typefaceId: roboto, typeSize: 20 },
    spans: [{ fromIndex: 1, toIndex: 2, attributes: { replacement: { extent: 50, ascent: 10, descent: 2 } } }],
    detail: "runs",
  });
  const box = replaced.lines[0].runs.find((r) => r.isReplacement);
  assert.equal(box.width, 50);
});

test("layout_text errors", async () => {
  const roboto = await loadRoboto();
  assert.ok((await call("layout_text", { text: "abc", defaults: {} })).error);
  assert.match((await call("layout_text", { text: "abc", defaults: { typefaceId: roboto }, spans: [{ fromIndex: 2, toIndex: 9, attributes: {} }] })).error, /Invalid span/);
  assert.match((await call("layout_text", { text: "abc", defaults: { typefaceId: roboto }, fromIndex: 3 })).error, /Invalid range/);
  assert.ok((await call("layout_text", { text: "abc", defaults: { typefaceId: "t999" } })).error);
});

test("layout_text lays out Urdu right to left", async () => {
  const nastaliq = (await call("font_load", { path: font("NotoNastaliqUrdu-Regular.ttf") })).faces[0].typefaceId;
  const result = await call("layout_text", {
    text: "اردو abc",
    defaults: { typefaceId: nastaliq, typeSize: 30, language: "ur" },
    detail: "runs",
  });
  assert.equal(result.lines[0].paragraphLevel, 1);
  assert.ok(result.lines[0].runs.some((r) => r.direction === "rtl"));
});

test("layout_break_lines", async () => {
  const roboto = await loadRoboto();
  const base = { text: "aaa bbb ccc", defaults: { typefaceId: roboto, typeSize: 20 } };
  const width = (await call("layout_text", base)).lines[0].width;
  const one = await call("layout_break_lines", { ...base, extent: width / 2 });
  assert.ok(one.breakIndex > 0 && one.breakIndex < base.text.length);
  const all = await call("layout_break_lines", { ...base, extent: width / 2, all: true });
  assert.ok(all.lineCount >= 2);
  assert.equal(all.lines.map((l) => l.text).join(""), base.text);
  const back = await call("layout_break_lines", { ...base, extent: width / 2, all: true, direction: "backward" });
  assert.equal(back.lines.map((l) => l.text).join(""), base.text);
  assert.ok((await call("layout_break_lines", { ...base, extent: 10, fromIndex: 5, toIndex: 5 })).error);
});

async function callRaw(name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  return { error: result.isError ? result.content[0].text : undefined, items: result.content.map((c) => c.text) };
}

test("render_text draws an SVG", async () => {
  const roboto = await loadRoboto();
  const { error, items } = await callRaw("render_text", {
    text: "abcabc",
    defaults: { typefaceId: roboto, typeSize: 40 },
    spans: [{ fromIndex: 3, toIndex: 6, attributes: { foregroundColor: "#FF0000", underline: true, backgroundColor: "#FFFF0080" } }],
    background: "#FFFFFF",
    padding: 4,
    debug: ["lineBoxes", "baselines", "inkBoxes"],
  });
  assert.equal(error, undefined);
  const meta = JSON.parse(items[0]);
  const svg = items[1];
  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="[\d.]+" height="[\d.]+"/);
  assert.equal(svg.match(/<path /g).length, 6);
  assert.match(svg, /fill="#ff0000"/);
  assert.match(svg, /fill="#ffff00" fill-opacity="0.502"/);
  assert.match(svg, /stroke="#ef4444"/);
  assert.equal(meta.lineCount, 1);
  assert.ok(svg.includes(`width="${meta.width}"`));

  const scaled = JSON.parse((await callRaw("render_text", { text: "abc", defaults: { typefaceId: roboto, typeSize: 40 } })).items[0]);
  const doubled = JSON.parse((await callRaw("render_text", { text: "abc", defaults: { typefaceId: roboto, typeSize: 40 }, renderScale: 2 })).items[0]);
  assert.ok(Math.abs(doubled.width / scaled.width - 2) < 0.05);
});

test("render_text strokes, shadows, wraps and writes a file", async () => {
  const roboto = await loadRoboto();
  const base = { text: "aaa bbb ccc", defaults: { typefaceId: roboto, typeSize: 30 } };
  const stroked = (await callRaw("render_text", { ...base, drawStyle: "fill-stroke", strokeRadius: 1, strokeColor: "#0000FF", shadow: { radius: 4, dx: 2, dy: 2 } })).items[1];
  assert.match(stroked, /stroke="#0000ff"[^>]*stroke-width="2"/);
  assert.match(stroked, /<feDropShadow/);

  const wrapped = JSON.parse((await callRaw("render_text", { ...base, frame: { width: 60 } })).items[0]);
  assert.ok(wrapped.lineCount > 1);

  const path = join(process.env.TMPDIR ?? "/tmp", `tehreer-mcp-${process.pid}.svg`);
  const written = await callRaw("render_text", { ...base, outputPath: path });
  assert.equal(JSON.parse(written.items[0]).outputPath, path);
  assert.equal(readFileSync(path, "utf8"), written.items[1]);
  assert.match((await callRaw("render_text", { ...base, outputPath: "relative.svg" })).error, /absolute/);
  assert.match((await callRaw("render_text", { ...base, renderScale: 16, defaults: { typefaceId: roboto, typeSize: 2000 } })).error, /limit/);
});

test("render_text draws Urdu", async () => {
  const nastaliq = (await call("font_load", { path: font("NotoNastaliqUrdu-Regular.ttf") })).faces[0].typefaceId;
  const { error, items } = await callRaw("render_text", { text: "اردو", defaults: { typefaceId: nastaliq, typeSize: 48, language: "ur" } });
  assert.equal(error, undefined);
  assert.ok(items[1].match(/<path /g).length >= 1);
});

test("render_glyph", async () => {
  const roboto = await loadRoboto();
  const plain = await callRaw("render_glyph", { typefaceId: roboto, char: "a", typeSize: 100, guides: true, background: "#EEEEEE" });
  assert.equal(plain.error, undefined);
  const meta = JSON.parse(plain.items[0]);
  assert.equal(meta.empty, false);
  assert.ok(meta.advance > 0 && meta.inkBox.width > 0);
  assert.match(plain.items[1], /<path d="M/);
  assert.match(plain.items[1], /stroke="#ef4444"/);
  const stroke = await callRaw("render_glyph", { typefaceId: roboto, glyphId: 0, drawStyle: "stroke", strokeWidth: 3 });
  assert.equal(stroke.error, undefined);
  assert.match((await callRaw("render_glyph", { typefaceId: roboto })).error, /exactly one/);
  assert.match((await callRaw("render_glyph", { typefaceId: roboto, char: "ab" })).error, /exactly one character/);
});
