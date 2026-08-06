import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createCrmProveContact,
  verifyCrmPrivateApp,
} from "./CrmPrivateAppConnect.js";

test("verifyCrmPrivateApp requires HubSpot token", async () => {
  const result = await verifyCrmPrivateApp({ provider: "hubspot", accessToken: "" });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_token");
});

test("verifyCrmPrivateApp accepts HubSpot when API returns ok", async () => {
  const result = await verifyCrmPrivateApp({
    provider: "hubspot",
    accessToken: "pat-test",
    fetchImpl: async () => ({ ok: true, status: 200, text: async () => "" }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.provider, "hubspot");
});

test("verifyCrmPrivateApp requires HighLevel location", async () => {
  const result = await verifyCrmPrivateApp({
    provider: "highlevel",
    accessToken: "key",
    locationId: "",
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_location");
});

test("createCrmProveContact returns HubSpot record id", async () => {
  const result = await createCrmProveContact({
    provider: "hubspot",
    accessToken: "pat-test",
    fetchImpl: async () => ({
      ok: true,
      status: 201,
      json: async () => ({ id: "hs_123" }),
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.providerId, "hs_123");
  assert.equal(result.evidenceKind, "hubspot_record_id");
  assert.equal(result.simulated, false);
});

test("createCrmProveContact returns HighLevel record id", async () => {
  const result = await createCrmProveContact({
    provider: "highlevel",
    accessToken: "key",
    locationId: "loc_1",
    fetchImpl: async () => ({
      ok: true,
      status: 201,
      json: async () => ({ contact: { id: "hl_99" } }),
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.providerId, "hl_99");
  assert.equal(result.evidenceKind, "highlevel_record_id");
});
