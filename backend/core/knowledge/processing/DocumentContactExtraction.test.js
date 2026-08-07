import test from "node:test";
import assert from "node:assert/strict";

import {
  extractContactFieldsFromText,
  processDocumentAndUpsertContact,
  runProcessTestDocumentProve,
} from "./DocumentContactExtraction.js";
import { emptyCrmState } from "../../crm/CrmStore.js";

function makeInstallation(overrides = {}) {
  return {
    id: "install_doc_1",
    businessId: "biz_doc_1",
    specificationId: "spec_1",
    configuration: { crm: emptyCrmState() },
    ...overrides,
  };
}

function makePlatformStore(installationRef) {
  return {
    async upsertBusinessOSInstallation(row) {
      installationRef.configuration = row.configuration;
      installationRef.history = row.history;
      return row;
    },
    async getBusinessOSInstallation() {
      return installationRef;
    },
  };
}

test("extractContactFieldsFromText finds labeled name/company + regex email/phone", () => {
  const text = [
    "Name: Jordan Rivera",
    "Company: Rivera Roofing & Repair LLC",
    "Email: jordan.rivera@example.com",
    "Phone: (555) 240-1180",
  ].join("\n");
  const extracted = extractContactFieldsFromText(text);
  assert.equal(extracted.name, "Jordan Rivera");
  assert.equal(extracted.company, "Rivera Roofing & Repair LLC");
  assert.equal(extracted.email, "jordan.rivera@example.com");
  assert.equal(extracted.phone, "(555) 240-1180");
});

test("extractContactFieldsFromText falls back to a signature-block name above a bare email", () => {
  const text = [
    "Thanks for reaching out.",
    "",
    "Best,",
    "Casey Kim",
    "casey.kim@example.com",
  ].join("\n");
  const extracted = extractContactFieldsFromText(text);
  assert.equal(extracted.name, "Casey Kim");
  assert.equal(extracted.email, "casey.kim@example.com");
});

test("extractContactFieldsFromText never invents fields it cannot find", () => {
  const extracted = extractContactFieldsFromText("No identifying information here at all.");
  assert.equal(extracted.name, null);
  assert.equal(extracted.email, null);
  assert.equal(extracted.phone, null);
  assert.equal(extracted.company, null);
});

test("processDocumentAndUpsertContact extracts fields and upserts a CRM contact", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);

  const result = await processDocumentAndUpsertContact({
    platformStore,
    installation,
    id: "doc_test_1",
    sourceType: "TXT",
    filename: "inquiry.txt",
    content: "Name: Taylor Chen\nCompany: Chen Consulting\nEmail: taylor@chenconsulting.com\nPhone: 555-201-9988",
    actorId: "tester",
  });

  assert.equal(result.ok, true);
  assert.equal(result.contactCreated, true);
  assert.equal(result.contact.name, "Taylor Chen");
  assert.equal(result.contact.email, "taylor@chenconsulting.com");
  assert.match(result.contact.notes, /Chen Consulting/);
  assert.ok(installation.configuration.crm.contacts.some((c) => c.email === "taylor@chenconsulting.com"));
});

test("processDocumentAndUpsertContact skips CRM upsert when no identifying fields are found", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);

  const result = await processDocumentAndUpsertContact({
    platformStore,
    installation,
    id: "doc_test_2",
    sourceType: "TXT",
    filename: "empty.txt",
    content: "No contact info in this document.",
  });

  assert.equal(result.ok, true);
  assert.equal(result.contact, null);
  assert.equal(result.contactCreated, false);
  assert.equal(result.reason, "no_identifying_fields");
});

test("runProcessTestDocumentProve processes a sample document end-to-end", async () => {
  const installation = makeInstallation();
  const platformStore = makePlatformStore(installation);
  const result = await runProcessTestDocumentProve({ platformStore, installation });
  assert.equal(result.ok, true);
  assert.equal(result.contactCreated, true);
  assert.equal(result.extracted.email, "jordan.rivera@example.com");
  assert.ok(installation.configuration.crm.contacts.length >= 1);
});
