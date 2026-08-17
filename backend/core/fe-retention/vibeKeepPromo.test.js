import test from "node:test";
import assert from "node:assert/strict";

import { isValidVibeKeepPromoCode, normalizeVibeKeepPromoCode } from "./vibeKeepPromo.js";

test("Crete88 is accepted with normal typing differences", () => {
  assert.equal(isValidVibeKeepPromoCode("Crete88"), true);
  assert.equal(isValidVibeKeepPromoCode("crete88"), true);
  assert.equal(isValidVibeKeepPromoCode("CRETE88"), true);
  assert.equal(isValidVibeKeepPromoCode(" Crete88 "), true);
  assert.equal(isValidVibeKeepPromoCode("Crete 88"), true);
  assert.equal(isValidVibeKeepPromoCode("nope"), false);
  assert.equal(isValidVibeKeepPromoCode(""), false);
  assert.equal(normalizeVibeKeepPromoCode("Crete 88"), "crete88");
});
