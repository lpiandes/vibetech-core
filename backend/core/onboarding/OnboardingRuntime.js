import { OnboardingEventEngine } from "./OnboardingEventEngine.js";
import { createOnboardingSession } from "./OnboardingSession.js";
import { createOnboardingProgress } from "./OnboardingProgress.js";
import { createOnboardingMetrics } from "./OnboardingMetrics.js";
import { deepFreeze } from "./_utils/deepFreeze.js";
import { createOnboardingStep, STEP_STATUS } from "./OnboardingStep.js";

import { createDefaultOnboardingTemplate } from "./defaultOnboardingTemplate.js";

/**
 * OnboardingRuntime (SSOT for onboarding state).
 */
export class OnboardingRuntime {
  constructor({
    companyId = "company",
    template = createDefaultOnboardingTemplate(),
    sessionId = `ob_${String(companyId).replace(/[^a-zA-Z0-9]+/g, "")}_${template.templateId}`,
    nowISO,
  } = {}) {
    if (!nowISO) throw new Error("OnboardingRuntime requires deterministic `nowISO`.");
    const resolvedNowISO = nowISO;

    this._templatesById = new Map();
    const tpl = template ?? createDefaultOnboardingTemplate();
    this._templatesById.set(String(tpl.templateId), tpl);

    const createdSession = createOnboardingSession({
      sessionId: String(sessionId),
      companyId: String(companyId),
      templateId: String(tpl.templateId),
      status: "IN_PROGRESS",
      startedAtISO: resolvedNowISO,
      completedAtISO: "",
      validationStatus: "IN_PROGRESS",
      createdAtISO: resolvedNowISO,
      updatedAtISO: resolvedNowISO,
      metadata: {},
    });

    const steps = (tpl.steps ?? []).map((s) => ({
      ...s,
      status: STEP_STATUS.PENDING,
      progress: 0,
      completedAt: "",
    }));

    const frozenSteps = steps.map((s) =>
      createOnboardingStep({
        id: s.id,
        title: s.title,
        description: s.description,
        requirements: s.requirements,
        metadata: s.metadata,
        status: STEP_STATUS.PENDING,
        progress: 0,
        completedAt: "",
      }),
    );

    const progress = createOnboardingProgress({ steps: frozenSteps });
    const metrics = createOnboardingMetrics({ session: createdSession, steps: frozenSteps, nowISO: resolvedNowISO });

    const recommendedNextAction = deepFreeze({
      actionType: "COMPLETE_STEP",
      stepId: frozenSteps[0]?.id ?? null,
      title: frozenSteps[0]?.title ?? "",
    });

    this._state = deepFreeze({
      session: createdSession,
      steps: frozenSteps,
      progress,
      metrics,
      recommendedNextAction,
    });

    this._engine = new OnboardingEventEngine({ runtime: this });
  }

  getTemplateForId(templateId) {
    return this._templatesById.get(String(templateId));
  }

  getSession() {
    return this._state.session;
  }

  getSteps() {
    return this._state.steps;
  }

  getCurrentStep() {
    return (this._state.steps ?? []).find((s) => s.status === STEP_STATUS.PENDING) ?? null;
  }

  getProgress() {
    return this._state.progress;
  }

  getMetrics() {
    return this._state.metrics;
  }

  getRecommendedNextAction() {
    return this._state.recommendedNextAction;
  }

  applyEvent(event) {
    this._engine.applyEvent(event);
  }
}

