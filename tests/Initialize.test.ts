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
