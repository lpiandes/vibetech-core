/**
 * Plan 7 — historical replay + shadow helpers over RFT contract + observation events.
 * Never sends outbound; never fabricates pass without running.
 */
import { deepFreeze } from "../../../workspace/_utils/deepFreeze.js";
import { normalizeRftServiceStandard } from "./rftContract.js";
import { readRftObservation } from "./rftObservation.js";
import { canTransition } from "./rftStateMachine.js";
import { resolveAutonomyDisposition } from "../../../company-rules/earnedAutonomy.js";

export const RFT_EXECUTION_MODES = Object.freeze({
  live: "live",
  shadow: "shadow",
  replay: "replay",
});

export function isNonLiveExecutionMode(mode) {
  const m = String(mode ?? "live");
  return m === RFT_EXECUTION_MODES.shadow || m === RFT_EXECUTION_MODES.replay;
}

/**
 * Classify what the contract would do for one opportunity-like event.
 * Plan 11: earned autonomy can elevate a class to AutoEligible; default remains ApprovalRequired.
 */
export function classifyReplayOpportunity({
  event = null,
  contract = null,
  installation = null,
  autonomyDisposition = null,
} = {}) {
  const rft = normalizeRftServiceStandard(contract?.rft ?? contract ?? null);
  const problems = [];
  const evidence = Array.isArray(event?.evidence) ? event.evidence : [];
  const hasOwner = Boolean(event?.personId || event?.email || event?.from?.email || event?.name);
  const customerFacing = ["inbound_email", "form_lead", "rft_opportunity"].includes(String(event?.kind));

  if (!hasOwner) {
    problems.push({ code: "missing_owner", detail: "No contact/person linked to opportunity." });
  }
  if (!evidence.length) {
    problems.push({ code: "missing_evidence", detail: "No provider evidence on observation event." });
  }
  if (/price|pricing|quote/i.test(String(event?.subject ?? event?.title ?? ""))) {
    if (rft.approvalRules.pricingOutsidePolicyRequiresApproval) {
      problems.push({
        code: "pricing_gap",
        detail: "Pricing language detected — approval required by contract.",
      });
    }
  }
  if (!rft.exceptionOwner) {
    problems.push({ code: "missing_exception_owner", detail: "Contract has no exception owner." });
  }

  let disposition = "eligible";
  let wouldAuto = false;
  let needsApproval = false;
  let wouldEscalate = false;
  let actionClassId = null;
  let autonomy = autonomyDisposition;

  if (problems.some((p) => p.code === "missing_owner" || p.code === "missing_evidence")) {
    disposition = "escalate";
    wouldEscalate = true;
  } else if (problems.some((p) => p.code === "pricing_gap")) {
    disposition = "needs_approval";
    needsApproval = true;
    actionClassId = "pricing_exception";
  } else {
    // Plan 11 — earned autonomy may elevate a class to AutoEligible
    if (!autonomy && installation) {
      autonomy = resolveAutonomyDisposition({ event, contract, installation });
    }
    actionClassId = autonomy?.classId ?? null;

    if (autonomy?.autoEligible) {
      disposition = "would_auto";
      wouldAuto = true;
    } else if (
      String(event?.kind) === "meeting"
      && (
        autonomy?.autoEligible
        || rft.approvalRules.existingCustomerSchedulingMayAuto
      )
    ) {
      disposition = "would_auto";
      wouldAuto = true;
      actionClassId = actionClassId ?? "existing_customer_scheduling";
    } else if (
      customerFacing
      && (
        rft.approvalRules.customerFacingRequiresApproval
        || rft.approvalRules.newProspectOutboundRequiresApproval
      )
    ) {
      disposition = "needs_approval";
      needsApproval = true;
      actionClassId = actionClassId ?? "new_prospect_outbound";
    } else if (!customerFacing && String(event?.kind) === "meeting") {
      disposition = "needs_approval";
      needsApproval = true;
      actionClassId = actionClassId ?? "existing_customer_scheduling";
    } else if (!customerFacing) {
      disposition = "would_auto";
      wouldAuto = true;
      actionClassId = actionClassId ?? "internal_crm_update";
    } else {
      disposition = "needs_approval";
      needsApproval = true;
    }
  }

  // Sanity: proposed path must be legal on the state machine
  const pathOk = canTransition("Detected", "ContextReady")
    && canTransition("ActionProposed", needsApproval ? "ApprovalRequired" : "AutoEligible");

  return deepFreeze({
    eventId: event?.id ?? null,
    kind: event?.kind ?? null,
    at: event?.at ?? null,
    title: event?.title ?? event?.subject ?? event?.name ?? null,
    disposition,
    wouldAuto,
    needsApproval,
    wouldEscalate,
    actionClassId,
    autonomyStatus: autonomy?.evaluation?.status ?? null,
    problems,
    pathOk,
    evidence,
    proposedNextState: wouldEscalate
      ? "Exception"
      : (needsApproval ? "ApprovalRequired" : "AutoEligible"),
  });
}

/**
 * Run historical replay over observation events (or provided event list).
 */
export function runHistoricalReplay({
  installation = null,
  contract = null,
  events = null,
  nowISO = null,
} = {}) {
  const at = nowISO ?? new Date().toISOString();
  const observation = readRftObservation(installation);
  const list = Array.isArray(events) ? events : observation.events;
  const opportunityLike = list.filter((e) =>
    ["inbound_email", "form_lead", "rft_opportunity", "meeting"].includes(String(e?.kind)),
  );

  const classifications = opportunityLike.map((event) =>
    classifyReplayOpportunity({ event, contract, installation }),
  );

  const summary = {
    eligible: classifications.filter((c) => c.disposition === "eligible" || c.disposition === "would_auto" || c.disposition === "needs_approval").length,
    wouldAutoComplete: classifications.filter((c) => c.wouldAuto).length,
    wouldNeedApproval: classifications.filter((c) => c.needsApproval).length,
    wouldEscalate: classifications.filter((c) => c.wouldEscalate).length,
    problemCount: classifications.reduce((n, c) => n + c.problems.length, 0),
    eventCount: classifications.length,
  };

  const potentialProblems = [];
  const seen = new Set();
  for (const c of classifications) {
    for (const p of c.problems) {
      const key = `${p.code}:${c.eventId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      potentialProblems.push({
        ...p,
        eventId: c.eventId,
        title: c.title,
        evidence: c.evidence,
      });
    }
  }

  // Pass criteria: ran on at least one event OR empty history with honest zero; no pathOk failures
  const pathFailures = classifications.filter((c) => c.pathOk === false).length;
  const passed = pathFailures === 0 && (
    classifications.length === 0
    || summary.wouldEscalate < classifications.length // not everything escalates as hard fail
  );

  return deepFreeze({
    version: 1,
    mode: RFT_EXECUTION_MODES.replay,
    ranAt: at,
    summary,
    classifications,
    potentialProblems: potentialProblems.slice(0, 50),
    passed,
    emptyWindow: classifications.length === 0,
    passDetail: passed
      ? (classifications.length
        ? `Replay classified ${classifications.length} opportunit${classifications.length === 1 ? "y" : "ies"}.`
        : "Empty-window pass — no historical opportunities in the observation window yet (not a success theater).")
      : `${pathFailures} illegal path(s) in replay.`,
    honesty: {
      message: classifications.length === 0
        ? "Empty observation window. Replay passed only because there was nothing to classify — connect channels and import history before treating this as proof."
        : "Replay proposes only. No email, SMS, or external CRM writes were performed.",
    },
  });
}

export function readRftReplay(installation = null) {
  const raw = installation?.configuration?.rftReplay;
  if (!raw || typeof raw !== "object") {
    return {
      version: 1,
      lastReplay: null,
      shadow: {
        enabled: false,
        enabledAt: null,
        proposals: [],
        corrections: [],
        passed: false,
        passedAt: null,
      },
    };
  }
  return {
    version: Number(raw.version) || 1,
    lastReplay: raw.lastReplay ?? null,
    shadow: {
      enabled: Boolean(raw.shadow?.enabled),
      enabledAt: raw.shadow?.enabledAt ?? null,
      proposals: Array.isArray(raw.shadow?.proposals) ? raw.shadow.proposals : [],
      corrections: Array.isArray(raw.shadow?.corrections) ? raw.shadow.corrections : [],
      passed: Boolean(raw.shadow?.passed),
      passedAt: raw.shadow?.passedAt ?? null,
    },
  };
}

export async function persistRftReplay({
  platformStore,
  installation,
  replayState,
  actorId = "rft_replay",
} = {}) {
  if (!platformStore || !installation) return null;
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId ?? `spec_${installation.businessId}`,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "rft_replay",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: Array.isArray(installation.actionCheckpoints) ? installation.actionCheckpoints : [],
    configuration: {
      ...(installation.configuration ?? {}),
      rftReplay: JSON.parse(JSON.stringify(replayState)),
    },
    history: Array.isArray(installation.history) ? installation.history.slice(-50) : [],
    installedAt: installation.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
  return replayState;
}

/**
 * Enable shadow mode — live events propose without external side effects.
 */
export function enableShadowMode(replayState = null, { nowISO = null } = {}) {
  const at = nowISO ?? new Date().toISOString();
  const prior = readRftReplay({ configuration: { rftReplay: replayState } });
  return deepFreeze({
    ...prior,
    shadow: {
      ...prior.shadow,
      enabled: true,
      enabledAt: at,
      passed: prior.shadow.passed,
      passedAt: prior.shadow.passedAt,
    },
  });
}

export function appendShadowProposal(replayState, proposal, { max = 100 } = {}) {
  const prior = readRftReplay({ configuration: { rftReplay: replayState } });
  const next = [proposal, ...prior.shadow.proposals].slice(0, max);
  return deepFreeze({
    ...prior,
    shadow: {
      ...prior.shadow,
      proposals: next,
    },
  });
}

export function recordShadowCorrection(replayState, correction, { nowISO = null } = {}) {
  const at = nowISO ?? new Date().toISOString();
  const prior = readRftReplay({ configuration: { rftReplay: replayState } });
  return deepFreeze({
    ...prior,
    shadow: {
      ...prior.shadow,
      corrections: [
        { ...correction, at },
        ...prior.shadow.corrections,
      ].slice(0, 100),
    },
  });
}

/**
 * Mark shadow passed after owner reviews (≥1 proposal or explicit empty-window pass).
 */
export function markShadowPassed(replayState, { nowISO = null, forceEmpty = false } = {}) {
  const at = nowISO ?? new Date().toISOString();
  const prior = readRftReplay({ configuration: { rftReplay: replayState } });
  if (!prior.shadow.enabled) {
    return {
      ok: false,
      code: "shadow_not_enabled",
      message: "Enable shadow mode before marking it passed.",
      state: prior,
    };
  }
  if (!forceEmpty && prior.shadow.proposals.length === 0 && prior.shadow.corrections.length === 0) {
    // Allow pass with zero proposals only when owner explicitly confirms empty window
    return {
      ok: false,
      code: "shadow_empty",
      message: "No shadow proposals yet. Process a live inbound in shadow, or confirm empty-window pass.",
      state: prior,
    };
  }
  const next = deepFreeze({
    ...prior,
    shadow: {
      ...prior.shadow,
      passed: true,
      passedAt: at,
    },
  });
  return { ok: true, state: next };
}

export function resolveExecutionModeFromInstallation(installation = null) {
  // Live external execution only after explicit go-live. Everything earlier is shadow
  // (proposals recorded, no unsupervised outbound) — even if shadow.passed is false.
  if (installation?.configuration?.rftLaunch?.goLiveAt) {
    return RFT_EXECUTION_MODES.live;
  }
  return RFT_EXECUTION_MODES.shadow;
}
