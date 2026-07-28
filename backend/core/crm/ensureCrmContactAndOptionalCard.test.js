import test from "node:test";
import assert from "node:assert/strict";

import { emptyCrmState } from "./CrmStore.js";
import {
  ensureCrmContactAndOptionalCard,
  findContact,
  tryDualWriteParty,
} from "./ensureCrmContactAndOptionalCard.js";
import { mapLeadRow, importLeadList } from "./importLeadList.js";
import { BusinessGraphRuntime } from "../business-graph/BusinessGraphRuntime.js";

test("ensureCrmContactAndOptionalCard aligns id and partyId and can add a card", () => {
  let crm = emptyCrmState();
  const result = ensureCrmContactAndOptionalCard(crm, {
    contact: { name: "Alex Lead", email: "alex@example.com", kind: "lead" },
    addToPipeline: true,
  });
  assert.equal(result.created, true);
  assert.equal(result.contact.id, result.contact.partyId);
  assert.ok(result.cardId);
  const pipe = result.crm.pipelines[0];
  const card = pipe.cards.find((c) => c.id === result.cardId);
  assert.equal(card.contactId, result.contact.id);
});

test("findContact dedupes by email then phone", () => {
  let crm = emptyCrmState();
  crm = ensureCrmContactAndOptionalCard(crm, {
    contact: { name: "Sam", email: "sam@x.com", phone: "555-0100" },
  }).crm;
  const byEmail = findContact(crm, { email: "SAM@x.com" });
  assert.equal(byEmail?.name, "Sam");
  const byPhone = findContact(crm, { phone: "(555) 0100" });
  assert.equal(byPhone?.name, "Sam");
});

test("tryDualWriteParty creates graph party with same id", () => {
  const graph = new BusinessGraphRuntime();
  const contact = { id: "contact_abc", name: "Pat", email: "pat@x.com", phone: "555", kind: "lead" };
  const first = tryDualWriteParty({ businessGraphRuntime: graph, contact, source: "test" });
  assert.equal(first.ok, true);
  assert.equal(first.created, true);
  assert.equal(graph.getParty("contact_abc")?.displayName, "Pat");
  const second = tryDualWriteParty({ businessGraphRuntime: graph, contact, source: "test" });
  assert.equal(second.existed, true);
});

test("mapLeadRow accepts flexible headers", () => {
  const mapped = mapLeadRow({
    "First Name": "Jordan",
    "Last Name": "Lee",
    Email: "j@x.com",
    Mobile: "555-9999",
    Source: "list_a",
  });
  assert.equal(mapped.name, "Jordan Lee");
  assert.equal(mapped.email, "j@x.com");
  assert.equal(mapped.phone, "555-9999");
  assert.ok(mapped.tags.includes("import"));
  assert.ok(mapped.tags.includes("list_a"));
});

test("importLeadList creates contacts and cards via platformStore fake", async () => {
  const installation = {
    id: "install_1",
    businessId: "biz_1",
    specificationId: "spec_1",
    configuration: { crm: emptyCrmState() },
  };
  let saved = null;
  const platformStore = {
    async upsertBusinessOSInstallation(row) {
      saved = row;
      installation.configuration = row.configuration;
      return row;
    },
  };
  const csv = [
    "Name,Email,Phone",
    "Casey One,casey@example.com,5551111",
    "Riley Two,riley@example.com,5552222",
  ].join("\n");

  const report = await importLeadList({
    platformStore,
    installation,
    actorId: "tester",
    csvText: csv,
    addToPipeline: true,
  });

  assert.equal(report.created, 2);
  assert.equal(report.updated, 0);
  assert.ok(report.cardsCreated >= 2);
  assert.ok(saved?.configuration?.crm?.contacts?.length >= 2);

  const again = await importLeadList({
    platformStore,
    installation,
    actorId: "tester",
    csvText: csv,
    addToPipeline: true,
  });
  assert.equal(again.created, 0);
  assert.equal(again.updated, 2);
});
