import assert from "node:assert/strict";
import { test } from "node:test";

import { detectIntraFileDuplicate, detectConsentConflicts } from "./ConflictDetector.js";
import { planConsentFromRow } from "./validation/ConsentImportValidator.js";

test("duplicate email in file is an error", () => {
  const seenEmails = new Set(["a@example.com"]);
  const result = detectIntraFileDuplicate({
    normalizedRow: { email: "a@example.com", sourceSystem: "generic_csv" },
    seenExternalRefs: new Set(),
    seenEmails,
    seenPhones: new Set(),
  });
  assert.ok(result.errors.some((e) => e.code === "duplicate_email_in_file"));
});

test("email alone does not plan consent", () => {
  const { planned } = planConsentFromRow({
    normalizedRow: { email: "a@example.com", emailOptIn: null, smsOptIn: null },
    profile: { consentMappings: {} },
    sourceSystem: "generic_csv",
  });
  assert.equal(planned.length, 0);
});

test("explicit opt-in plans consent", () => {
  const { planned } = planConsentFromRow({
    normalizedRow: { emailOptIn: true, consentSource: "crm_export" },
    profile: { consentMappings: {} },
    sourceSystem: "generic_csv",
  });
  assert.equal(planned.length, 1);
  assert.equal(planned[0].status, "opt_in");
});

test("consent weaken blocked when existing opt_out", () => {
  const result = detectConsentConflicts({
    normalizedRow: {},
    partyId: "party_1",
    canonicalSnapshot: {
      preferencesByPartyId: {
        party_1: [{ channel: "email", scope: "all", status: "opt_out" }],
      },
    },
    plannedConsents: [{ channel: "email", scope: "all", status: "opt_in" }],
  });
  assert.ok(result.errors.some((e) => e.code === "consent_weaken_blocked"));
});
