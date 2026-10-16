/*
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

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { getVersion, initialize } from "../src/index.js";
import { Module } from "../src/internal/Module.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

test("the module is loaded once, and reports the version of Core", async () => {
  const first = initialize();
  const second = initialize();
  assert.equal(first, second);
  await first;
  assert.equal(getVersion(), "1.0.0");
});

test("every function that the bindings declare is exported by the module", async () => {
  await initialize();
  const exported = JSON.parse(readFileSync(join(root, "native/exports.json"), "utf8")) as string[];
  const module = Module as unknown as Record<string, unknown>;
  const missing = exported.filter((name) => typeof module[name] !== "function");
  assert.deepEqual(missing, []);
  assert.ok(exported.length > 300);
});
