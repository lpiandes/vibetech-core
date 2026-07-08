import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveIdentity } from "./IdentityResolver.js";
import { IMPORT_MATCH_TIERS } from "./ImportRunStatus.js";

const snapshot = {
  parties: [
    {
      id: "party_jane_example_com",
      displayName: "Jane Doe",
      contactMethods: ["jane@example.com"],
      externalReferences: ["follow_up_boss:123"],
    },
    {
      id: "party_phone_5551234567",
      displayName: "Bob Smith",
      contactMethods: ["5551234567"],
      externalReferences: [],
    },
    {
      id: "party_phone_5559999999",
      displayName: "Other Person",
      contactMethods: ["5559999999"],
      externalReferences: [],
    },
  ],
};

test("identity tier 1 external reference", () => {
  const result = resolveIdentity({
    normalizedRow: { externalContactId: "123", email: "other@example.com", rowNumber: 1 },
    sourceSystem: "follow_up_boss",
    canonicalSnapshot: snapshot,
  });
  assert.equal(result.partyId, "party_jane_example_com");
  assert.equal(result.matchTier, IMPORT_MATCH_TIERS.EXTERNAL_REF);
});

test("identity tier 2 email", () => {
  const result = resolveIdentity({
    normalizedRow: { email: "jane@example.com", rowNumber: 1 },
    sourceSystem: "generic_csv",
    canonicalSnapshot: snapshot,
  });
  assert.equal(result.matchTier, IMPORT_MATCH_TIERS.EMAIL);
});

test("email and phone conflict returns identity conflict", () => {
  const result = resolveIdentity({
    normalizedRow: { email: "jane@example.com", phone: "5559999999", rowNumber: 1 },
    sourceSystem: "generic_csv",
    canonicalSnapshot: snapshot,
  });
  assert.equal(result.partyId, null);
  assert.ok(result.identityConflict);
});

test("new party when no match", () => {
  const result = resolveIdentity({
    normalizedRow: { email: "new@example.com", rowNumber: 5 },
    sourceSystem: "generic_csv",
    canonicalSnapshot: snapshot,
  });
  assert.equal(result.matchTier, IMPORT_MATCH_TIERS.NEW);
  assert.equal(result.partyId, "party_new_example_com");
});
