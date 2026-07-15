import assert from "node:assert/strict";
import test from "node:test";

import {
  importDriveCandidatesToKnowledge,
  proposeDriveImportCandidates,
} from "./DriveToKnowledgeImport.js";
import {
  createAccountingReadAdapter,
  mapAccountingRecordToMemoryFacts,
} from "../accounting/AccountingReadAdapter.js";

test("Drive → Knowledge proposes tagged imports without treating Drive as SoT", () => {
  const candidates = proposeDriveImportCandidates({
    files: [{ id: "file_1", name: "Parent handbook.pdf", mimeType: "application/pdf" }],
    defaultCategoryIds: ["CURRICULUM", "POLICIES"],
  });
  assert.equal(candidates.length, 1);
  assert.deepEqual(candidates[0].proposedCategoryIds, ["CURRICULUM", "POLICIES"]);
  assert.match(candidates[0].note, /not the live source of truth/i);
});

test("Drive → Knowledge import uploads into Knowledge service", async () => {
  const uploaded = [];
  const result = await importDriveCandidatesToKnowledge({
    businessId: "biz_1",
    userId: "user_1",
    candidates: [{ id: "file_1", title: "SOP", mimeType: "application/pdf", proposedCategoryIds: ["SOP"] }],
    knowledgeService: {
      async uploadDocument(input) {
        uploaded.push(input);
        return { id: "doc_1", categoryIds: input.categoryIds };
      },
    },
    fetchFileBytes: async () => Buffer.from("policy text"),
  });
  assert.equal(result.imported.length, 1);
  assert.equal(result.imported[0].knowledgeDocumentId, "doc_1");
  assert.equal(uploaded[0].categoryIds[0], "SOP");
});

test("Accounting read maps SoR records into Memory facts, not a GL UI", async () => {
  const facts = mapAccountingRecordToMemoryFacts({
    id: "inv_9",
    customerId: "party_1",
    openBalance: 1200,
    invoiceStatus: "open",
    currency: "USD",
  });
  assert.ok(facts.some((f) => f.kind === "open_balance" && f.value === 1200));
  assert.ok(facts.some((f) => f.kind === "invoice_status" && f.value === "open"));

  const adapter = createAccountingReadAdapter({
    providerId: "quickbooks",
    listRecords: async () => ({
      records: [{ id: "inv_9", customerId: "party_1", balance: 50, status: "paid" }],
      nextCursor: null,
    }),
  });
  const pulled = await adapter.pullMemoryFacts({ businessId: "biz_1" });
  assert.equal(pulled.ok, true);
  assert.ok(pulled.facts.length >= 1);
  assert.equal(adapter.connectionType, "accounting");
});
