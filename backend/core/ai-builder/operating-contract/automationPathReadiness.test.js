import test from "node:test";
import assert from "node:assert/strict";

import {
  attachAutomationPathReadiness,
  buildPathReadinessSnapshot,
  computeStepReadiness,
  computeTriggerReadiness,
} from "./automationPathReadiness.js";
import { presentAutomationPath, PATH_STEP_TYPES } from "./automationPath.js";

test("START ready for manual-only trigger", () => {
  const r = computeTriggerReadiness({ mode: "manual", eventTypes: [] }, {});
  assert.equal(r.ready, true);
});

test("START blocks INBOUND_VOICE_CALL without voice connection", () => {
  const r = computeTriggerReadiness(
    { mode: "manual_or_events", eventTypes: ["INBOUND_VOICE_CALL", "SPECIALTY_JOB_REQUESTED"] },
    buildPathReadinessSnapshot({ businessId: "biz1", appOrigin: "https://app.example.com" }),
  );
  assert.equal(r.ready, false);
  assert.ok(r.blockers.some((b) => b.code === "voice_not_connected"));
  assert.ok(r.blockers[0].href?.includes("voice_channel"));
});

test("START ready when voice connected and public origin", () => {
  const r = computeTriggerReadiness(
    { mode: "manual_or_events", eventTypes: ["INBOUND_VOICE_CALL"] },
    buildPathReadinessSnapshot({
      businessId: "biz1",
      connectedTypes: ["voice_channel"],
      appOrigin: "https://app.example.com",
    }),
  );
  assert.equal(r.ready, true);
});

test("email step blocks without business_email", () => {
  const r = computeStepReadiness(
    { type: PATH_STEP_TYPES.SEND_EMAIL, enabled: true },
    buildPathReadinessSnapshot({ businessId: "biz1" }),
  );
  assert.equal(r.ready, false);
  assert.equal(r.blockers[0].code, "email_not_connected");
});

test("email step ready when connected; manual does not block", () => {
  const r = computeStepReadiness(
    { type: PATH_STEP_TYPES.SEND_EMAIL, enabled: true, runMode: "manual" },
    buildPathReadinessSnapshot({
      businessId: "biz1",
      connectedTypes: ["business_email"],
    }),
  );
  assert.equal(r.ready, true);
});

test("pipeline blocks when crm unavailable", () => {
  const r = computeStepReadiness(
    { type: PATH_STEP_TYPES.ADD_TO_PIPELINE, enabled: true },
    buildPathReadinessSnapshot({ crmAvailable: false }),
  );
  assert.equal(r.ready, false);
  assert.equal(r.blockers[0].code, "crm_unavailable");
});

test("social_screen blocks without screening keys", () => {
  const r = computeStepReadiness(
    { type: PATH_STEP_TYPES.SOCIAL_SCREEN, enabled: true },
    buildPathReadinessSnapshot({ socialScreeningReady: false, businessId: "biz1" }),
  );
  assert.equal(r.ready, false);
  assert.equal(r.blockers[0].code, "social_screening_keys");
});

test("presentAutomationPath attaches readiness when snapshot provided", () => {
  const presented = presentAutomationPath({
    contract: {
      trigger: {
        mode: "manual_or_events",
        eventTypes: ["INBOUND_VOICE_CALL"],
        summary: "When an inbound phone call arrives",
      },
      automationPath: {
        version: 1,
        customized: true,
        steps: [
          { id: "s1", type: "add_to_pipeline", enabled: true, runMode: "auto", pipelineLabel: "New leads" },
          { id: "s2", type: "send_email", enabled: true, runMode: "manual", subject: "Hi" },
        ],
      },
    },
    readinessSnapshot: buildPathReadinessSnapshot({
      businessId: "biz1",
      connectedTypes: ["voice_channel"],
      appOrigin: "https://app.example.com",
      crmAvailable: true,
    }),
  });
  assert.equal(presented.trigger.readiness.ready, true);
  assert.equal(presented.steps[0].readiness.ready, true);
  assert.equal(presented.steps[1].readiness.ready, false);
});

test("attachAutomationPathReadiness is idempotent-safe", () => {
  const base = presentAutomationPath({
    contract: {
      trigger: { mode: "manual" },
      automationPath: { steps: [{ id: "d", type: "create_draft" }] },
    },
  });
  const withReady = attachAutomationPathReadiness(base, buildPathReadinessSnapshot({}));
  assert.equal(withReady.trigger.readiness.ready, true);
  assert.equal(withReady.steps[0].readiness.ready, true);
});
