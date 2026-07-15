import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPlatformSetupChecklist,
  deriveRequiredSetupStepsFromSpecification,
  platformSetupIncompleteSummary,
} from "./buildPlatformSetupChecklist.js";

test("home checklist includes calendar voice sms meta and scheduling from OS plan", () => {
  const checklist = buildPlatformSetupChecklist({
    workspaceId: "biz_1",
    requiredSetupSteps: deriveRequiredSetupStepsFromSpecification({
      metadata: { requiredSetupSteps: ["email", "calendar", "sms", "a2p_registration", "voice"] },
      integrationRequirements: [
        { integrationId: "business_email", status: "required" },
        { integrationId: "calendar", status: "required" },
        { integrationId: "sms_channel", status: "required" },
        { integrationId: "voice_channel", status: "required" },
        { integrationId: "meta_lead_ads", status: "required" },
      ],
      capabilityRequirements: [{ capabilityId: "scheduling" }],
    }),
    connections: [],
    teamInviteChecklistComplete: false,
    knowledgeCount: 0,
  });

  const ids = checklist.map((entry) => entry.id);
  assert.ok(ids.includes("email"));
  assert.ok(ids.includes("calendar"));
  assert.ok(ids.includes("sms"));
  assert.ok(ids.includes("a2p_registration"));
  assert.ok(ids.includes("voice"));
  assert.ok(ids.includes("meta_lead_ads"));
  assert.ok(ids.includes("scheduling"));
  assert.ok(ids.includes("team"));
  assert.ok(ids.includes("knowledge"));
  assert.equal(checklist.every((entry) => entry.complete), false);
  assert.ok(checklist.find((entry) => entry.id === "sms")?.external?.some((line) => /twilio/i.test(line)));
});

test("platform incomplete summary surfaces honest next step", () => {
  const summary = platformSetupIncompleteSummary([
    { id: "email", title: "Connect business email", complete: false },
    { id: "calendar", title: "Connect Google Calendar", complete: false },
  ]);
  assert.ok(summary);
  assert.match(summary.headline, /Platform incomplete/i);
  assert.equal(summary.incompleteCount, 2);
});
