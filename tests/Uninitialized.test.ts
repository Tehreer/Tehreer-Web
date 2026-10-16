import assert from "node:assert/strict";
import { test } from "node:test";
import { TText, getVersion, initialize } from "../src/index.js";

test("objects cannot be made before the module is initialized", async () => {
  assert.throws(() => new TText("abc"), /not initialized/);
  assert.throws(() => getVersion(), /not initialized/);
  await initialize();
  assert.equal(new TText("abc").length, 3);
});
