import assert from "node:assert/strict";
import { test } from "node:test";

import { syncContactsToExternal, syncContactsFromExternal } from "./CrmExternalSync.js";

test("syncContactsToExternal rejects unknown provider", async () => {
  const result = await syncContactsToExternal({ provider: "salesforce", accessToken: "x", contacts: [] });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "unknown_provider");
});

test("syncContactsToExternal requires an access token", async () => {
  const result = await syncContactsToExternal({ provider: "hubspot", accessToken: "", contacts: [] });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "missing_token");
});

test("syncContactsToExternal pushes People contacts to HubSpot and skips contacts without email", async () => {
  const calls = [];
  const result = await syncContactsToExternal({
    provider: "hubspot",
    accessToken: "pat-test",
    contacts: [
      { id: "contact_1", name: "Jordan Lee", email: "jordan@example.com", phone: "+15551230000" },
      { id: "contact_2", name: "No Email" },
    ],
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), body: JSON.parse(init.body) });
      return { ok: true, status: 201, json: async () => ({ id: "hs_1" }) };
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.provider, "hubspot");
  assert.equal(result.attempted, 2);
  assert.equal(result.pushed, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.properties.email, "jordan@example.com");
  const skipped = result.results.find((r) => r.contactId === "contact_2");
  assert.equal(skipped.ok, false);
  assert.equal(skipped.reason, "missing_email");
});

test("syncContactsToExternal pushes People contacts to HighLevel with a location id", async () => {
  const result = await syncContactsToExternal({
    provider: "highlevel",
    accessToken: "key",
    locationId: "loc_1",
    contacts: [{ id: "contact_1", name: "Sam Rivera", email: "sam@example.com" }],
    fetchImpl: async () => ({
      ok: true,
      status: 201,
      json: async () => ({ contact: { id: "hl_1" } }),
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.pushed, 1);
  assert.equal(result.results[0].externalReference, "hl_1");
});

test("syncContactsToExternal fails HighLevel push without a location id", async () => {
  const result = await syncContactsToExternal({
    provider: "highlevel",
    accessToken: "key",
    contacts: [{ id: "contact_1", name: "Sam Rivera", email: "sam@example.com" }],
    fetchImpl: async () => {
      throw new Error("should not call fetch without a location id");
    },
  });
  assert.equal(result.ok, false);
  assert.equal(result.results[0].reason, "missing_location");
});

test("syncContactsFromExternal pulls recent HubSpot contacts", async () => {
  const result = await syncContactsFromExternal({
    provider: "hubspot",
    accessToken: "pat-test",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        results: [
          { id: "1001", properties: { firstname: "Ada", lastname: "Lovelace", email: "ada@example.com", phone: "+15550001111" } },
        ],
      }),
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.pulled, 1);
  assert.equal(result.contacts[0].externalReference, "1001");
  assert.equal(result.contacts[0].name, "Ada Lovelace");
  assert.equal(result.contacts[0].source, "hubspot_sync");
});

test("syncContactsFromExternal pulls recent HighLevel contacts", async () => {
  const result = await syncContactsFromExternal({
    provider: "highlevel",
    accessToken: "key",
    locationId: "loc_1",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        contacts: [{ id: "hl_55", firstName: "Grace", lastName: "Hopper", email: "grace@example.com" }],
      }),
    }),
  });
  assert.equal(result.ok, true);
  assert.equal(result.pulled, 1);
  assert.equal(result.contacts[0].externalReference, "hl_55");
  assert.equal(result.contacts[0].source, "highlevel_sync");
});

test("syncContactsFromExternal fails closed when the CRM API rejects the pull", async () => {
  const result = await syncContactsFromExternal({
    provider: "hubspot",
    accessToken: "pat-test",
    fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({}) }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, "pull_failed");
  assert.deepEqual(result.contacts, []);
});
