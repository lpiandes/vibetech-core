import test from "node:test";
import assert from "node:assert/strict";
import {
  buildOpsPlaybook,
  buildMetaCreativeBrief,
  formatOpsPlaybookEmail,
  listOpsPlaybookIds,
} from "./OpsPlaybookRegistry.js";

test("ops playbook ids are locked", () => {
  const ids = listOpsPlaybookIds();
  assert.ok(ids.includes("meta_lead_connect_existing"));
  assert.ok(ids.includes("meta_lead_create_from_scratch"));
  assert.ok(ids.includes("twilio_sms_provision"));
  assert.ok(ids.includes("twilio_voice_connect"));
  assert.ok(ids.includes("salesforce_connect"));
});

test("meta connect playbook has POST connect step", () => {
  const p = buildOpsPlaybook("meta_lead_connect_existing", {
    origin: "https://app.vtechdevelopment.com",
    businessId: "biz_1",
    businessName: "Mind and Mobility",
    pageName: "Mind and Mobility",
    webhookUrl: "https://app.vtechdevelopment.com/api/webhook",
    integrationsHref: "https://app.vtechdevelopment.com/b/biz_1/integrations",
    adminHref: "/admin/businesses/biz_1",
  });
  assert.match(p.steps.join("\n"), /integrations\/meta/);
  assert.equal(p.creativeBrief, null);
});

test("meta from-scratch includes creative brief", () => {
  const p = buildOpsPlaybook("meta_lead_create_from_scratch", {
    origin: "https://app.vtechdevelopment.com",
    businessId: "biz_1",
    businessName: "Mind and Mobility",
    industry: "wellness",
    webhookUrl: "https://x/webhook",
    integrationsHref: "https://x/i",
    adminHref: "/admin/x",
  });
  assert.ok(p.creativeBrief);
  assert.match(formatOpsPlaybookEmail(p), /Creative brief/);
  assert.match(p.steps.join("\n"), /CREATIVE/);
});

test("wellness creative brief uses mobility-friendly copy", () => {
  const brief = buildMetaCreativeBrief({
    industry: "mobility",
    businessName: "Mind and Mobility",
    offer: "physical therapy consult",
    geo: "NH",
  });
  assert.equal(brief.industryKey, "wellness");
  assert.match(brief.headline, /Mind and Mobility/);
});
