import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  AI_ARCHITECT_LIFECYCLE,
  validateLifecycleTransition,
} from "../platform/constitution/AiArchitectLifecycle.js";

/**
 * Maps persisted BuilderSession stages → Product/Platform Architect lifecycle stages.
 *
 * BUILDER_SESSION_STAGES remain the durable session state.
 * AI_ARCHITECT_LIFECYCLE is the product lifecycle (conversation → … → operate → improve).
 * ArchitectPipeline stages are intelligence-only — never session state, never owner-facing.
 *
 * @see docs/product/VIBETECH_PRODUCT_CONSTITUTION.md
 */

/** Session stages that are exceptional (failure / archive) — not constitution product stages. */
export const EXCEPTIONAL_SESSION_STAGES = Object.freeze([
  "blocked",
  "failed",
  "archived",
]);

/**
 * Canonical mapping: persisted session stage → constitution lifecycle stage.
 * Multiple session stages may share one constitution stage (e.g. interviewing ⊂ evidence).
 */
export const SESSION_STAGE_TO_CONSTITUTION = deepFreeze({
  created: "discovery",
  discovering: "discovery",
  researching: "research",
  interviewing: "evidence",
  assembling: "business_os",
  proposal_ready: "preview",
  awaiting_review: "preview",
  dry_run_ready: "dry_run",
  awaiting_approval: "approval",
  installing: "install",
  installed: "operate",
});

/** Owner-facing progress labels for constitution stages (never engineering terms). */
export const CONSTITUTION_STAGE_OWNER_LABELS = deepFreeze({
  discovery: "Learning about your business",
  research: "Gathering context",
  evidence: "Understanding how you work",
  business_dna: "Forming a picture",
  reasoning: "Thinking through recommendations",
  business_os: "Preparing your recommendation",
  preview: "Review your recommendation",
  dry_run: "Checking readiness",
  approval: "Ready for your approval",
  install: "Going live",
  operate: "Live",
  improve: "Improving how you operate",
});

export function sessionStageToConstitution(sessionStage) {
  const key = String(sessionStage ?? "");
  if (EXCEPTIONAL_SESSION_STAGES.includes(key)) return null;
  return SESSION_STAGE_TO_CONSTITUTION[key] ?? null;
}

export function constitutionStageOwnerLabel(constitutionStage) {
  return CONSTITUTION_STAGE_OWNER_LABELS[String(constitutionStage)] ?? null;
}

/**
 * Validate a persisted session stage transition against the constitution lifecycle.
 *
 * Rules:
 * - Same constitution stage: always ok (session gerunds within one product stage).
 * - Forward progress along AI_ARCHITECT_LIFECYCLE: ok (product may skip research/evidence).
 * - Continuous improve (operate → earlier recommendation stages): treated as operate → improve → target.
 * - Backward / lateral moves: must match constitution ALLOWED_TRANSITIONS.
 * - blocked / failed / archived: exceptional, always ok.
 */
export function validateSessionStageTransition({ from, to } = {}) {
  const fromStage = String(from ?? "");
  const toStage = String(to ?? "");

  if (fromStage === toStage) {
    return deepFreeze({ ok: true, from: fromStage, to: toStage, constitution: null });
  }

  if (
    EXCEPTIONAL_SESSION_STAGES.includes(toStage)
    || EXCEPTIONAL_SESSION_STAGES.includes(fromStage)
  ) {
    return deepFreeze({
      ok: true,
      from: fromStage,
      to: toStage,
      constitution: null,
      exceptional: true,
    });
  }

  const fromConstitution = sessionStageToConstitution(fromStage);
  const toConstitution = sessionStageToConstitution(toStage);

  if (!fromConstitution || !toConstitution) {
    return deepFreeze({
      ok: false,
      reason: "unknown_session_stage",
      from: fromStage,
      to: toStage,
    });
  }

  if (fromConstitution === toConstitution) {
    return deepFreeze({
      ok: true,
      from: fromStage,
      to: toStage,
      constitution: { from: fromConstitution, to: toConstitution },
    });
  }

  const fromIdx = AI_ARCHITECT_LIFECYCLE.indexOf(fromConstitution);
  const toIdx = AI_ARCHITECT_LIFECYCLE.indexOf(toConstitution);

  // Forward skip along the product lifecycle (e.g. discovery → preview when seeding continuous).
  if (fromIdx >= 0 && toIdx >= fromIdx) {
    return deepFreeze({
      ok: true,
      from: fromStage,
      to: toStage,
      constitution: {
        from: fromConstitution,
        to: toConstitution,
        forwardProgress: true,
      },
    });
  }

  // Pre-install refinement: while forming a recommendation (not yet readiness/approval),
  // the owner can share more evidence (e.g. assembling → researching).
  const refinementSources = new Set(["business_dna", "reasoning", "business_os", "preview"]);
  const refinementTargets = new Set(["discovery", "research", "evidence"]);
  if (refinementSources.has(fromConstitution) && refinementTargets.has(toConstitution)) {
    return deepFreeze({
      ok: true,
      from: fromStage,
      to: toStage,
      constitution: {
        from: fromConstitution,
        to: toConstitution,
        refinement: true,
      },
    });
  }

  // Continuous improvement: live business re-enters recommendation flow.
  if (fromConstitution === "operate" && toConstitution !== "operate") {
    const lifecycle = validateLifecycleTransition({
      from: "improve",
      to: toConstitution,
    });
    if (!lifecycle.ok) {
      return deepFreeze({
        ok: false,
        reason: lifecycle.reason,
        from: fromStage,
        to: toStage,
        constitution: {
          from: fromConstitution,
          to: toConstitution,
          validatedFrom: "improve",
          allowed: lifecycle.allowed ?? [],
        },
      });
    }
    return deepFreeze({
      ok: true,
      from: fromStage,
      to: toStage,
      constitution: {
        from: fromConstitution,
        to: toConstitution,
        validatedFrom: "improve",
      },
    });
  }

  const lifecycle = validateLifecycleTransition({
    from: fromConstitution,
    to: toConstitution,
  });

  if (!lifecycle.ok) {
    return deepFreeze({
      ok: false,
      reason: lifecycle.reason,
      from: fromStage,
      to: toStage,
      constitution: {
        from: fromConstitution,
        to: toConstitution,
        allowed: lifecycle.allowed ?? [],
      },
    });
  }

  return deepFreeze({
    ok: true,
    from: fromStage,
    to: toStage,
    constitution: {
      from: fromConstitution,
      to: toConstitution,
    },
  });
}

export function assertSessionStageTransition({ from, to } = {}) {
  const result = validateSessionStageTransition({ from, to });
  if (!result.ok) {
    throw new Error(
      `BuilderSession: illegal stage transition ${from} → ${to}`
        + (result.constitution?.validatedFrom
          ? ` (constitution ${result.constitution.validatedFrom} → ${result.constitution.to})`
          : ` (${result.reason})`),
    );
  }
  return result;
}
