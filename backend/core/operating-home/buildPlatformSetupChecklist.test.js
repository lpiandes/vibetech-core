import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPlatformSetupChecklist,
  deriveRequiredSetupStepsFromSpecification,
  platformSetupIncompleteSummary,
} from "./buildPlatformSetupChecklist.js";

test("home checklist uses one calendar mission when scheduling is part of the OS plan", () => {
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
  assert.equal(ids.filter((id) => id === "calendar").length, 1);
  assert.ok(!ids.includes("scheduling"));
  assert.ok(ids.includes("team"));
  assert.ok(ids.includes("knowledge"));
  assert.equal(checklist.every((entry) => entry.complete), false);
  assert.ok(checklist.find((entry) => entry.id === "sms")?.external?.some((line) => /twilio/i.test(line)));
});

test("platform incomplete summary surfaces honest next step", () => {
  const summary = platformSetupIncompleteSummary([
    { id: "email", title: "Choose customer email inbox", complete: false },
    { id: "calendar", title: "Connect Google Calendar", complete: false },
  ]);
  assert.ok(summary);
  assert.match(summary.headline, /Platform incomplete/i);
  assert.equal(summary.incompleteCount, 2);
});

test("growth channels appear only when the owner selected them and remain incomplete until verified", () => {
  const checklist = buildPlatformSetupChecklist({
    workspaceId: "biz_growth",
    requiredSetupSteps: deriveRequiredSetupStepsFromSpecification({
      metadata: { requiredSetupSteps: ["google_search_console", "google_ads", "meta_ads"] },
      integrationRequirements: [
        { integrationId: "google_search_console", status: "required" },
        { integrationId: "google_ads", status: "required" },
        { integrationId: "meta_ads", status: "required" },
      ],
    }),
    connections: [{ id: "google_search_console", status: "CONNECTED" }],
    includeTeamAndKnowledge: false,
  });
  assert.deepEqual(checklist.map((item) => item.id), ["google_search_console", "google_ads", "meta_ads"]);
  assert.equal(checklist[0].complete, true);
  assert.equal(checklist[1].complete, false);
  assert.match(checklist[2].href, /focus=meta_ads/);
});
