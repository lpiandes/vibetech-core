import assert from "node:assert/strict";
import { test } from "node:test";

import { OnboardingRuntime } from "./OnboardingRuntime.js";
import { createOnboardingEvent } from "./OnboardingEvent.js";
import { ONBOARDING_EVENT_TYPES } from "./OnboardingEventTypes.js";

const NOW0 = "2026-07-01T00:00:00.000Z";
const NOW1 = "2026-07-01T00:00:10.000Z";
const NOW2 = "2026-07-01T00:00:20.000Z";

test("Session creation: steps seeded and state is immutable", () => {
  const runtime = new OnboardingRuntime({ companyId: "co_1", nowISO: NOW0 });

  const session = runtime.getSession();
  assert.equal(session.companyId, "co_1");
  assert.equal(session.templateId, "default");
  assert.equal(session.status, "IN_PROGRESS");
  assert.equal(session.startedAtISO, NOW0);
  assert.ok(Object.isFrozen(session));

  const steps = runtime.getSteps();
  assert.equal(steps.length, 8);
  assert.ok(Array.isArray(steps));
  assert.ok(Object.isFrozen(steps));

  for (const step of steps) {
    assert.ok(Object.isFrozen(step));
    assert.equal(step.status, "PENDING");
    assert.equal(step.progress, 0);
    assert.equal(step.completedAt, "");
  }

  assert.equal(runtime.getCurrentStep().id, "company_profile");
  assert.equal(runtime.getProgress().completionPercent, 0);
  assert.equal(runtime.getRecommendedNextAction().actionType, "COMPLETE_STEP");
});

test("Step progression: ONBOARDING_STEP_COMPLETED updates status, progress, and completedAt", () => {
  const runtime = new OnboardingRuntime({ companyId: "co_1", nowISO: NOW0 });

  const prevSteps = runtime.getSteps();
  const prevStep0 = prevSteps[0];

  runtime.applyEvent(
    createOnboardingEvent({
      id: "evt_complete_step1",
      timestampISO: NOW1,
      type: ONBOARDING_EVENT_TYPES.ONBOARDING_STEP_COMPLETED,
      source: "test",
      payload: { stepId: "company_profile" },
    }),
  );

  const step0After = runtime.getSteps()[0];
  assert.ok(Object.isFrozen(step0After));
  assert.equal(step0After.status, "COMPLETED");
  assert.equal(step0After.progress, 100);
  assert.equal(step0After.completedAt, NOW1);
  assert.notEqual(step0After, prevStep0); // replaced with a new frozen object

  const progress = runtime.getProgress();
  assert.equal(progress.completedSteps, 1);
  assert.equal(progress.completionPercent, (1 / 8) * 100);

  const metrics = runtime.getMetrics();
  assert.equal(metrics.elapsedMs, 10000); // NOW1 - NOW0

  const next = runtime.getRecommendedNextAction();
  assert.equal(next.actionType, "COMPLETE_STEP");
  assert.equal(next.stepId, "business_setup");
});

test("Progress calculations: completed + skipped determine completionPercent", () => {
  const runtime = new OnboardingRuntime({ companyId: "co_1", nowISO: NOW0 });

  runtime.applyEvent(
    createOnboardingEvent({
      id: "evt_complete_company_profile",
      timestampISO: NOW1,
      type: ONBOARDING_EVENT_TYPES.ONBOARDING_STEP_COMPLETED,
      source: "test",
      payload: { stepId: "company_profile" },
    }),
  );
  runtime.applyEvent(
    createOnboardingEvent({
      id: "evt_skip_business_setup",
      timestampISO: NOW2,
      type: ONBOARDING_EVENT_TYPES.ONBOARDING_STEP_SKIPPED,
      source: "test",
      payload: { stepId: "business_setup" },
    }),
  );

  const progress = runtime.getProgress();
  assert.equal(progress.completedSteps, 1);
  assert.equal(progress.skippedSteps, 1);
  assert.equal(progress.pendingSteps, 6);
  assert.equal(progress.completionPercent, (2 / 8) * 100);
});

test("Recommended next action: COMPLETE_ONBOARDING when no pending remains", () => {
  const runtime = new OnboardingRuntime({ companyId: "co_1", nowISO: NOW0 });

  const steps = runtime.getSteps();
  const stepIds = steps.map((s) => s.id);
  const actions = {};
  for (let i = 0; i < stepIds.length; i += 1) {
    actions[stepIds[i]] = i % 2 === 0 ? "complete" : "skip";
  }

  let t = NOW1;
  for (const stepId of stepIds) {
    runtime.applyEvent(
      createOnboardingEvent({
        id: `evt_${stepId}`,
        timestampISO: t,
        type:
          actions[stepId] === "complete"
            ? ONBOARDING_EVENT_TYPES.ONBOARDING_STEP_COMPLETED
            : ONBOARDING_EVENT_TYPES.ONBOARDING_STEP_SKIPPED,
        source: "test",
        payload: { stepId },
      }),
    );

    // Increment deterministically (20s each iteration)
    t = new Date(t).toISOString().replace("Z", "+00:00");
  }

  const next = runtime.getRecommendedNextAction();
  assert.equal(next.actionType, "COMPLETE_ONBOARDING");
  assert.equal(next.stepId, null);
});

test("Event application: ONBOARDING_COMPLETED sets session to COMPLETED and passes validation", () => {
  const runtime = new OnboardingRuntime({ companyId: "co_1", nowISO: NOW0 });

  // Mark all steps completed deterministically.
  for (const step of runtime.getSteps()) {
    runtime.applyEvent(
      createOnboardingEvent({
        id: `evt_done_${step.id}`,
        timestampISO: NOW1,
        type: ONBOARDING_EVENT_TYPES.ONBOARDING_STEP_COMPLETED,
        source: "test",
        payload: { stepId: step.id },
      }),
    );
  }

  runtime.applyEvent(
    createOnboardingEvent({
      id: "evt_onboarding_complete",
      timestampISO: NOW2,
      type: ONBOARDING_EVENT_TYPES.ONBOARDING_COMPLETED,
      source: "test",
      payload: {},
    }),
  );

  const session = runtime.getSession();
  assert.equal(session.status, "COMPLETED");
  assert.equal(session.completedAtISO, NOW2);
  assert.equal(session.validationStatus, "PASSED");

  const next = runtime.getRecommendedNextAction();
  assert.equal(next.actionType, "NONE");
});

