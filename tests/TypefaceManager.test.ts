import assert from "node:assert/strict";
import { afterEach, before, test } from "node:test";
import { type Typeface, TypefaceManager, TypeSlope, TypeWeight, TypeWidth } from "../src/index.js";
import { ROBOTO, ROBOTO_VARIABLE, loadFont, ready } from "./Support.js";

before(ready);

const registered: Typeface[] = [];

afterEach(() => {
  for (const typeface of registered.splice(0)) {
    TypefaceManager.unregisterTypeface(typeface);
  }
});

function register(typeface: Typeface, tag = 0, familyId = 0): boolean {
  const done = TypefaceManager.registerTypeface(typeface, tag, familyId);
  if (done) {
    registered.push(typeface);
  }
  return done;
}

test("typefaces are registered by tag and family", () => {
  const typeface = loadFont(ROBOTO).typefaces.get(0);
  assert.ok(register(typeface, 41, 7));
  assert.ok(!register(typeface, 42), "a typeface is registered once");
  assert.ok(TypefaceManager.getTypeface(41)!.equals(typeface));
  assert.equal(TypefaceManager.getTypefaceTag(typeface), 41);
  assert.equal(TypefaceManager.getTypefaceFamilyId(typeface), 7);
  assert.equal(TypefaceManager.getTypeface(0), undefined);
  assert.equal(TypefaceManager.getTypeface(99), undefined);

  assert.ok(!register(loadFont(ROBOTO).typefaces.get(0), 41), "a tag is taken once");
});

test("the typeface that is closest to a style is picked", () => {
  const variable = loadFont(ROBOTO_VARIABLE).typefaces.get(0);
  const light = variable.getVariationInstance([300, 100])!;
  const bold = variable.getVariationInstance([700, 100])!;
  register(light, 0, 5);
  register(bold, 0, 5);

  const family = TypefaceManager.getAvailableFamilies().find((f) => f.familyId === 5)!;
  assert.equal(family.familyName, "Roboto");
  assert.ok(family.getTypefaceByStyle(TypeWidth.Normal, TypeWeight.Bold, TypeSlope.Plain)!.equals(bold));
  assert.ok(family.getTypefaceByStyle(TypeWidth.Normal, 350, TypeSlope.Plain)!.equals(light));
  assert.ok(TypefaceManager.getTypeFamily("roboto")!.equals(family));
  assert.equal(TypefaceManager.getTypeFamily("Nobody"), undefined);
});

test("typefaces without a family id are matched by name", () => {
  const typeface = loadFont(ROBOTO).typefaces.get(0);
  register(typeface);
  const found = TypefaceManager.getTypefaceByStyle("ROBOTO", TypeWidth.Normal, TypeWeight.Regular, TypeSlope.Plain);
  assert.ok(found!.equals(typeface));
  assert.equal(TypefaceManager.getTypefaceByStyle("Other", TypeWidth.Normal, TypeWeight.Regular, TypeSlope.Plain), undefined);
  assert.ok(TypefaceManager.getTypefaceByName("Roboto Regular")!.equals(typeface));
});

test("the registered typefaces are listed in order", () => {
  const variable = loadFont(ROBOTO_VARIABLE).typefaces.get(0);
  register(loadFont(ROBOTO).typefaces.get(0));
  register(variable.getVariationInstance([400, 100])!);
  assert.equal(TypefaceManager.getAvailableTypefaces().length, 2);
  assert.ok(TypefaceManager.getAvailableFamilies().length >= 1);
});

test("a typeface that is unregistered is free to be registered again", () => {
  const typeface = loadFont(ROBOTO).typefaces.get(0);
  assert.ok(register(typeface, 9));
  assert.ok(TypefaceManager.unregisterTypeface(typeface));
  assert.ok(!TypefaceManager.unregisterTypeface(typeface));
  registered.length = 0;
  assert.equal(TypefaceManager.getTypeface(9), undefined);
  assert.ok(register(typeface, 9));
});
