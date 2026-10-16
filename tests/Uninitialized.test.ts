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
import { test } from "node:test";
import { TText, getVersion, initialize } from "../src/index.js";

test("objects cannot be made before the module is initialized", async () => {
  assert.throws(() => new TText("abc"), /not initialized/);
  assert.throws(() => getVersion(), /not initialized/);
  await initialize();
  assert.equal(new TText("abc").length, 3);
});
