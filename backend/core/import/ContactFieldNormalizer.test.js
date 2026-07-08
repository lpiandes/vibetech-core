import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeEmail,
  normalizePhone,
  stablePartyIdFromEmail,
  composeDisplayName,
} from "./normalizers/ContactFieldNormalizer.js";

test("normalizeEmail lowercases and validates", () => {
  assert.equal(normalizeEmail(" Jane@Example.COM "), "jane@example.com");
  assert.equal(normalizeEmail("not-an-email"), null);
});

test("normalizePhone keeps digits", () => {
  assert.equal(normalizePhone("(555) 123-4567"), "5551234567");
});

test("stablePartyIdFromEmail matches operating loop convention", () => {
  assert.equal(stablePartyIdFromEmail("jane@example.com"), "party_jane_example_com");
});

test("composeDisplayName prefers full name", () => {
  assert.equal(composeDisplayName({ fullName: "Jane Doe", firstName: "X" }), "Jane Doe");
  assert.equal(composeDisplayName({ firstName: "Jane", lastName: "Doe" }), "Jane Doe");
});
