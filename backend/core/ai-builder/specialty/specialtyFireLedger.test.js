/**
 * Specialty fire ledger unit tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  appendSpecialtyFireEntry,
  readSpecialtyFireLedger,
  summarizePayload,
} from "./specialtyFireLedger.js";

test("appendSpecialtyFireEntry prepends and caps", () => {
  let ledger = readSpecialtyFireLedger(null);
  for (let i = 0; i < 105; i += 1) {
    ({ ledger } = appendSpecialtyFireEntry(ledger, {
      id: `fire_${i}`,
      eventType: "FORM_SUBMIT",
      employeeId: "emp_1",
      ok: true,
      workId: `work_${i}`,
    }));
  }
  assert.equal(ledger.entries.length, 100);
  assert.equal(ledger.entries[0].id, "fire_104");
});

test("summarizePayload keeps short keys", () => {
  const s = summarizePayload({ contactId: "c1", name: "Ada", nested: { a: 1 } });
  assert.match(String(s), /contactId/);
  assert.match(String(s), /\[object\]/);
});
