import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  mapMetaLeadFields,
  verifyMetaWebhookSignature,
  ingestMetaLead,
} from "./ingestMetaLead.js";

test("mapMetaLeadFields reads common lead form names", () => {
  const mapped = mapMetaLeadFields({
    field_data: [
      { name: "full_name", values: ["Alex Patient"] },
      { name: "email", values: ["alex@clinic.test"] },
      { name: "phone_number", values: ["+16035550123"] },
    ],
  });
  assert.equal(mapped.name, "Alex Patient");
  assert.equal(mapped.email, "alex@clinic.test");
  assert.equal(mapped.phone, "+16035550123");
});

test("verifyMetaWebhookSignature accepts valid hmac", () => {
  const rawBody = '{"entry":[]}';
  const signatureHeader = `sha256=${createHmac("sha256", "test_secret").update(rawBody).digest("hex")}`;
  const ok = verifyMetaWebhookSignature({ rawBody, signatureHeader, appSecret: "test_secret" });
  assert.equal(ok.ok, true);
  const bad = verifyMetaWebhookSignature({ rawBody, signatureHeader: "sha256=deadbeef", appSecret: "test_secret" });
  assert.equal(bad.ok, false);
});

test("ingestMetaLead creates CRM contact and optional pipeline card", async () => {
  const installation = {
    id: "inst_1",
    businessId: "biz_meta",
    configuration: {
      crm: {
        contacts: [],
        pipelines: [{
          id: "pipe_1",
          name: "Intake",
          stages: [{ id: "stage_new", label: "New", order: 0 }],
          cards: [],
        }],
        calendarEvents: [],
      },
      employees: [],
    },
  };
  let saved = null;
  const platformStore = {
    async getBusinessOSInstallation() {
      return installation;
    },
    async upsertBusinessOSInstallation(row) {
      saved = row;
      return row;
    },
  };

  const result = await ingestMetaLead({
    businessId: "biz_meta",
    platformStore,
    installation,
    leadgenId: "lead_123",
    formId: "form_9",
    pageId: "page_1",
    syntheticLead: {
      id: "lead_123",
      field_data: [
        { name: "full_name", values: ["Sam Lead"] },
        { name: "email", values: ["sam@fb.test"] },
      ],
    },
    prove: true,
    actorId: "test",
  });

  assert.equal(result.ok, true);
  assert.equal(result.contact.name, "Sam Lead");
  assert.ok(result.contactId);
  assert.ok(result.cardId);
  assert.ok(saved, "CRM write should persist installation");
});
