#!/usr/bin/env node
// Copyright (C) 2026 Muhammad Tayyab Akram
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Reads the public headers of Tehreer Core and of SheenBidi, and writes
//   native/exports.json                  the functions that the WebAssembly module exports, and
//   src/internal/NativeFunctions.ts      their TypeScript declarations.
//
// The WebAssembly C ABI passes a struct by value (TRPoint, TRSize, TRRect) through a pointer to a
// copy, and returns it through a pointer that comes first in the arguments. The declarations show
// that, so the wrapper never has to guess.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const core = resolve(process.env.TEHREER_CORE ?? join(root, "build/wasm/_deps/tehreercore-src"));
const headers = join(core, "Headers/Tehreer");
// SheenBidi is what the unicode package wraps. Only these headers are, and the text API is not,
// as it is experimental. The build links them to `build/deps/SheenBidi`.
const sheenBidi = resolve(process.env.SHEENBIDI_DIR ?? join(root, "build/deps/SheenBidi"), "Headers/SheenBidi");
const SHEENBIDI_HEADERS = [
  "SBAlgorithm.h",
  "SBCodepoint.h",
  "SBLine.h",
  "SBMirrorLocator.h",
  "SBParagraph.h",
  "SBScript.h",
  "SBScriptLocator.h",
];

// Declared by Core but not implemented, or needing headers of another library.
const EXCLUDED = new Set(["TRVersionGetString", "TRTextGetSheenBidiText"]);
const STRUCTS = new Set(["TRPoint", "TRSize", "TRRect", "TRAffineTransform"]);

function stripComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*#.*$/gm, " ");
}

function splitParameters(list) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (const character of list) {
    if (character === "(") depth++;
    if (character === ")") depth--;
    if (character === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.filter((part) => part !== "void");
}

function parameterName(parameter) {
  const pointer = /\(\s*\*\s*(\w+)\s*\)/.exec(parameter);
  if (pointer) return pointer[1];
  return /(\w+)\s*$/.exec(parameter)[1];
}

function isStruct(type) {
  const bare = type.replace(/\bconst\b/g, "").trim();
  return STRUCTS.has(bare);
}

const functions = [];

const sources = [
  ...readdirSync(headers)
    .filter((name) => /^TR.*\.h$/.test(name))
    .sort()
    .map((file) => ({ file, directory: headers, macro: "TR_PUBLIC", prefix: "TR" })),
  ...SHEENBIDI_HEADERS.map((file) => ({ file, directory: sheenBidi, macro: "SB_PUBLIC", prefix: "SB" })),
];

for (const { file, directory, macro, prefix } of sources) {
  const text = stripComments(readFileSync(join(directory, file), "utf8"));
  for (const match of text.matchAll(new RegExp(`${macro}\\s+([^;]+?);`, "g"))) {
    const declaration = match[1].replace(/\s+/g, " ").trim();
    const parsed = new RegExp(`^(.*?)\\b(${prefix}\\w+)\\s*\\((.*)\\)$`).exec(declaration);
    if (!parsed) throw new Error(`Cannot parse: ${declaration}`);

    const [, returnType, name, list] = parsed;
    if (EXCLUDED.has(name)) continue;

    const parameters = splitParameters(list).map((parameter) => ({
      name: parameterName(parameter),
      isStruct: isStruct(parameter.replace(/\w+\s*$/, "")),
    }));
    const returnsStruct = isStruct(returnType);
    const returnsVoid = returnType.trim() === "void";

    functions.push({
      file,
      name,
      signature: declaration,
      parameters,
      returnsStruct,
      returnsVoid,
    });
  }
}

writeFileSync(
  join(root, "native/exports.json"),
  JSON.stringify(["_malloc", "_free", ...functions.map((f) => `_${f.name}`)], null, 2) + "\n",
);

let out = `/*
 * Copyright (C) 2026 Muhammad Tayyab Akram
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Generated by scripts/generate-bindings.mjs from Headers/Tehreer/*.h and the headers of SheenBidi. Do not edit.
//
// Every argument and result is a number: pointers are heap addresses, \`TRBoolean\` is 0 or 1,
// and floats are doubles. A struct that Core takes by value is passed as the address of a copy,
// and one that it returns is written to the address that is the first argument (\`ret\`).

/** The functions of Tehreer Core and of SheenBidi that the WebAssembly module exports. */
export interface NativeFunctions {
`;

for (const f of functions) {
  const parameters = f.parameters.map((p) => `${p.name}: number`);
  if (f.returnsStruct) parameters.unshift("ret: number");
  const result = f.returnsVoid || f.returnsStruct ? "void" : "number";
  const notes = [];
  if (f.returnsStruct) notes.push("returns a struct through `ret`");
  const byValue = f.parameters.filter((p) => p.isStruct).map((p) => p.name);
  if (byValue.length > 0) notes.push(`struct by value: ${byValue.join(", ")}`);
  out += `  /** \`${f.signature}\`${notes.length ? " (" + notes.join("; ") + ")" : ""} */\n`;
  out += `  _${f.name}(${parameters.join(", ")}): ${result};\n`;
}
out += `}\n`;

writeFileSync(join(root, "src/internal/NativeFunctions.ts"), out);
console.log(`Generated ${functions.length} functions.`);
