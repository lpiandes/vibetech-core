import { ONBOARDING_EVENT_TYPES } from "./OnboardingEventTypes.js";
import { createOnboardingSession } from "./OnboardingSession.js";
import { createOnboardingProgress } from "./OnboardingProgress.js";
import { createOnboardingMetrics } from "./OnboardingMetrics.js";
import { createOnboardingStep, STEP_STATUS } from "./OnboardingStep.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) deepFreeze(value[key]);
  return Object.freeze(value);
}

function requiredString(v, name) {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`OnboardingEventEngine: expected ${name} to be a non-empty string.`);
  }
}

function computeRecommendedNextAction({ session, steps } = {}) {
  if (session?.status === "NOT_STARTED") {
    return { actionType: "START_ONBOARDING", stepId: null, title: "Start onboarding" };
  }

  const pending = (steps ?? []).filter((s) => s.status === STEP_STATUS.PENDING);
  if (pending.length) {
    const next = pending[0];
    return { actionType: "COMPLETE_STEP", stepId: next.id, title: next.title };
  }

  if (session?.status !== "COMPLETED") {
    // If no pending remains, allow completion action even if some steps were skipped.
    return { actionType: "COMPLETE_ONBOARDING", stepId: null, title: "Complete onboarding" };
  }

  return { actionType: "NONE", stepId: null, title: "Onboarding completed" };
}

function computeValidationStatus({ session, steps } = {}) {
  const pending = (steps ?? []).some((s) => s.status === STEP_STATUS.PENDING);
  if (session?.status === "COMPLETED") return "PASSED";
  if (pending) return "IN_PROGRESS";
  return "IN_PROGRESS";
}

function cloneStepsWithUpdatedStatus({ steps, stepId, status, timestampISO, metadata } = {}) {
  const updated = (steps ?? []).map((s) => {
    if (s.id !== stepId) return s;
    const nextProgress = status === STEP_STATUS.COMPLETED || status === STEP_STATUS.SKIPPED ? 100 : s.progress;
    return createOnboardingStep({
      ...s,
      status,
      progress: nextProgress,
      completedAt: timestampISO,
      metadata: { ...(s.metadata ?? {}), ...(metadata ?? {}) },
    });
  });
  return updated;
}

export class OnboardingEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) throw new Error("OnboardingEventEngine requires runtime.");
    this.runtime = runtime;
  }

  applyEvent(event) {
    if (!event || typeof event !== "object") throw new Error("OnboardingEventEngine: event required.");
    requiredString(event.type, "event.type");
    if (!Object.values(ONBOARDING_EVENT_TYPES).includes(event.type)) {
      throw new Error(`OnboardingEventEngine: unsupported event type: ${event.type}`);
    }

    const { _state: prevState } = this.runtime;
    const timestampISO = String(event.timestamp ?? "");
    requiredString(timestampISO, "event.timestamp");

    let nextSession = prevState.session;
    let nextSteps = prevState.steps;

    switch (event.type) {
      case ONBOARDING_EVENT_TYPES.ONBOARDING_STARTED: {
        const companyId = String(event.payload?.companyId ?? prevState.session.companyId ?? "");
        requiredString(companyId, "payload.companyId");

        const templateId = String(event.payload?.templateId ?? prevState.session.templateId ?? "default");

        const sessionId = String(
          event.payload?.sessionId ?? prevState.session.sessionId ?? `ob_${companyId}_${templateId}`,
        );

        nextSession = createOnboardingSession({
          sessionId,
          companyId,
          templateId,
          status: "IN_PROGRESS",
          startedAtISO: timestampISO,
          completedAtISO: "",
          validationStatus: "IN_PROGRESS",
          createdAtISO: timestampISO,
          updatedAtISO: timestampISO,
          metadata: prevState.session.metadata,
        });

        // Reset steps from runtime template definitions.
        const template = this.runtime.getTemplateForId(templateId);
        nextSteps = template?.steps ?? [];
        break;
      }

      case ONBOARDING_EVENT_TYPES.ONBOARDING_STEP_COMPLETED: {
        const stepId = String(event.payload?.stepId ?? "");
        requiredString(stepId, "payload.stepId");
        nextSteps = cloneStepsWithUpdatedStatus({
          steps: prevState.steps,
          stepId,
          status: STEP_STATUS.COMPLETED,
          timestampISO,
          metadata: event.payload?.metadata ?? {},
        });
        break;
      }

      case ONBOARDING_EVENT_TYPES.ONBOARDING_STEP_SKIPPED: {
        const stepId = String(event.payload?.stepId ?? "");
        requiredString(stepId, "payload.stepId");
        nextSteps = cloneStepsWithUpdatedStatus({
          steps: prevState.steps,
          stepId,
          status: STEP_STATUS.SKIPPED,
          timestampISO,
          metadata: event.payload?.metadata ?? {},
        });
        break;
      }

      case ONBOARDING_EVENT_TYPES.ONBOARDING_COMPLETED: {
        // This assumes governance approved completion; we just reflect it.
        nextSession = {
          ...prevState.session,
          status: "COMPLETED",
          completedAtISO: timestampISO,
          updatedAtISO: timestampISO,
          validationStatus: computeValidationStatus({ session: { ...prevState.session, status: "COMPLETED" }, steps: prevState.steps }),
        };
        break;
      }

      default:
        throw new Error(`OnboardingEventEngine: unhandled event type: ${event.type}`);
    }

    const progress = createOnboardingProgress({ steps: nextSteps });
    const metrics = createOnboardingMetrics({ session: nextSession, steps: nextSteps, nowISO: timestampISO });

    const validationStatus = computeValidationStatus({ session: nextSession, steps: nextSteps });

    const finalSession = deepFreeze({
      ...nextSession,
      validationStatus,
      updatedAtISO: timestampISO,
    });

    const recommendedNextAction = computeRecommendedNextAction({
      session: finalSession,
      steps: nextSteps,
    });

    const nextState = {
      ...prevState,
      session: finalSession,
      steps: deepFreeze(nextSteps),
      progress,
      metrics,
      recommendedNextAction,
    };

    this.runtime._state = deepFreeze(nextState);
  }
}

