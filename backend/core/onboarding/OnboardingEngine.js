import { createOnboardingEvent } from "./OnboardingEvent.js";
import { ONBOARDING_EVENT_TYPES } from "./OnboardingEventTypes.js";

function deterministicStableIdPart(value) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export class OnboardingEngine {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("OnboardingEngine requires runtime.");
    this.runtime = runtime;
  }

  startOnboarding({ companyId, templateId = "default", sessionId, nowISO } = {}) {
    const resolvedCompanyId = companyId ?? this.runtime.getSession()?.companyId ?? "";
    if (!resolvedCompanyId) throw new Error("OnboardingEngine: companyId is required to start onboarding.");

    if (!nowISO) throw new Error("OnboardingEngine.startOnboarding requires deterministic `nowISO`.");

    const id = sessionId
      ? `ob_evt_start_${deterministicStableIdPart(sessionId)}`
      : `ob_evt_start_${deterministicStableIdPart(resolvedCompanyId)}_${deterministicStableIdPart(templateId)}`;

    const event = createOnboardingEvent({
      id,
      timestampISO: now,
      type: ONBOARDING_EVENT_TYPES.ONBOARDING_STARTED,
      source: "onboarding-engine",
      payload: { companyId: resolvedCompanyId, templateId, sessionId: sessionId ?? undefined },
    });
    this.runtime.applyEvent(event);

    return this.runtime.getSession();
  }

  completeStep({ stepId, completedAtISO } = {}) {
    if (!completedAtISO) throw new Error("OnboardingEngine.completeStep requires deterministic `completedAtISO`.");
    const now = completedAtISO;
    const event = createOnboardingEvent({
      id: `ob_evt_step_completed_${deterministicStableIdPart(stepId)}_${deterministicStableIdPart(now)}`,
      timestampISO: now,
      type: ONBOARDING_EVENT_TYPES.ONBOARDING_STEP_COMPLETED,
      source: "onboarding-engine",
      payload: { stepId },
    });
    this.runtime.applyEvent(event);
    return this.runtime.getProgress();
  }

  skipStep({ stepId, completedAtISO } = {}) {
    if (!completedAtISO) throw new Error("OnboardingEngine.skipStep requires deterministic `completedAtISO`.");
    const now = completedAtISO;
    const event = createOnboardingEvent({
      id: `ob_evt_step_skipped_${deterministicStableIdPart(stepId)}_${deterministicStableIdPart(now)}`,
      timestampISO: now,
      type: ONBOARDING_EVENT_TYPES.ONBOARDING_STEP_SKIPPED,
      source: "onboarding-engine",
      payload: { stepId },
    });
    this.runtime.applyEvent(event);
    return this.runtime.getProgress();
  }

  completeOnboarding({ completedAtISO } = {}) {
    if (!completedAtISO) throw new Error("OnboardingEngine.completeOnboarding requires deterministic `completedAtISO`.");
    const now = completedAtISO;
    const event = createOnboardingEvent({
      id: `ob_evt_complete_${deterministicStableIdPart(now)}`,
      timestampISO: now,
      type: ONBOARDING_EVENT_TYPES.ONBOARDING_COMPLETED,
      source: "onboarding-engine",
      payload: {},
    });
    this.runtime.applyEvent(event);
    return this.runtime.getMetrics();
  }
}

