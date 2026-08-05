/**
 * Plan 11 — Earned autonomy per action class.
 * Default deny. Rates + evidence + Plan 7 gates + explicit delegation.
 * Never blanket auto-send; version bump invalidates until re-earned.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { readOperatorInterventions } from "../admin/operatorInterventions.js";
import { normalizeRftServiceStandard } from "../ai-builder/operating-contract/rft/rftContract.js";

export const EARNED_AUTONOMY_VERSION = 1;

/** Minimum decisions before a class can earn auto. */
export const MIN_SAMPLE = 5;

/** Clean approvals / total decisions. */
export const MIN_APPROVAL_RATE = 0.9;

/** Edits / total decisions — above this stays gated. */
export const MAX_EDIT_RATE = 0.1;

/** Critical incident reasons that block auto. */
export const CRITICAL_REASON_CODES = Object.freeze([
  "ai_quality_failure",
  "provider_failure",
  "incorrect_classification",
]);

export const EDIT_LIKE_REASONS = Object.freeze([
  "tone_edit",
  "facts_corrected",
  "timing_change",
  "scope_change",
  "owner_preference",
]);

export const CLEAN_APPROVAL_REASONS = Object.freeze([
  "approved_as_proposed",
]);

/**
 * RFT action-class catalog — risk-tiered, aligned to permitted actions + specialty paths.
 */
export const RFT_ACTION_CLASSES = Object.freeze([
  {
    id: "existing_customer_scheduling",
    label: "Existing-customer scheduling",
    risk: "medium",
    description: "Propose or confirm schedule for known customers.",
    permittedActions: ["propose_schedule"],
    eventKinds: ["meeting"],
  },
  {
    id: "new_prospect_outbound",
    label: "New-prospect outbound",
    risk: "high",
    description: "Customer-facing ack / first outbound to new prospects.",
    permittedActions: ["send_acknowledgement_after_approval", "draft_acknowledgement", "draft_follow_up"],
    eventKinds: ["inbound_email", "form_lead", "rft_opportunity"],
  },
  {
    id: "pricing_exception",
    label: "Pricing exception",
    risk: "critical",
    description: "Quotes or pricing outside policy.",
    permittedActions: [],
    eventKinds: [],
  },
  {
    id: "internal_crm_update",
    label: "Internal CRM update",
    risk: "low",
    description: "Capture, classify, assign, update CRM (non-customer-facing).",
    permittedActions: ["detect_opportunity", "capture_in_crm", "classify", "assign_owner", "update_crm"],
    eventKinds: [],
  },
]);

function readCorrections(installation = null) {
  const raw = installation?.configuration?.governedLearning;
  return asArray(raw?.corrections);
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

export function actionClassById(classId) {
  return RFT_ACTION_CLASSES.find((c) => c.id === String(classId)) ?? null;
}

export function readEarnedAutonomy(installation = null) {
  const raw = installation?.configuration?.rftAutonomy;
  if (!raw || typeof raw !== "object") {
    return {
      version: EARNED_AUTONOMY_VERSION,
      classes: {},
      updatedAt: null,
    };
  }
  const classes = {};
  const rawClasses = raw.classes && typeof raw.classes === "object" ? raw.classes : {};
  for (const [id, row] of Object.entries(rawClasses)) {
    if (!row || typeof row !== "object") continue;
    classes[id] = {
      classId: id,
      delegatedAt: row.delegatedAt ?? null,
      delegatedBy: row.delegatedBy ?? null,
      revokedAt: row.revokedAt ?? null,
      revokedBy: row.revokedBy ?? null,
      earnedAtPolicyHash: row.earnedAtPolicyHash ?? null,
      earnedAtContractVersion: row.earnedAtContractVersion ?? null,
      lastEvaluatedAt: row.lastEvaluatedAt ?? null,
      lastMetrics: row.lastMetrics ?? null,
      lastStatus: row.lastStatus ?? null,
      lastReasons: asArray(row.lastReasons),
    };
  }
  return {
    version: Number(raw.version) || EARNED_AUTONOMY_VERSION,
    classes,
    updatedAt: raw.updatedAt ?? null,
  };
}

/**
 * Map a correction or event to an action class (honest defaults).
 */
export function inferActionClass({ correction = null, event = null, title = null } = {}) {
  if (correction?.actionClass && actionClassById(correction.actionClass)) {
    return String(correction.actionClass);
  }
  const kind = String(event?.kind ?? correction?.original?.kind ?? "");
  const blob = [
    title,
    event?.title,
    event?.subject,
    correction?.original?.title,
    correction?.note,
    correction?.reasonCode,
  ].filter(Boolean).join(" ").toLowerCase();

  if (/price|pricing|quote/.test(blob) || correction?.reasonCode === "scope_change" && /pric/.test(blob)) {
    return "pricing_exception";
  }
  if (kind === "meeting" || /schedul|meeting|calendar|book/.test(blob)) {
    return "existing_customer_scheduling";
  }
  if (
    ["inbound_email", "form_lead", "rft_opportunity"].includes(kind)
    || /outbound|acknowledg|prospect|follow.?up/.test(blob)
    || correction?.source === "owner_approval"
  ) {
    return "new_prospect_outbound";
  }
  return "internal_crm_update";
}

function isEditReason(code) {
  return EDIT_LIKE_REASONS.includes(String(code ?? ""));
}

function isCleanApproval(code, decision) {
  if (CLEAN_APPROVAL_REASONS.includes(String(code ?? ""))) return true;
  const d = String(decision ?? "").toUpperCase();
  return d === "GRANTED" || d === "APPROVED" || d === "APPROVE";
}

function isCriticalReason(code) {
  return CRITICAL_REASON_CODES.includes(String(code ?? ""));
}

/**
 * Aggregate rates for one class from Plan 10 corrections (+ optional shadow).
 */
export function computeClassMetrics({
  classId,
  corrections = [],
  shadowCorrections = [],
  closedInterventions = [],
} = {}) {
  const id = String(classId);
  const relevant = corrections.filter((c) => inferActionClass({ correction: c }) === id);
  const shadowHits = asArray(shadowCorrections).filter((c) =>
    inferActionClass({
      correction: {
        reasonCode: c.reasonCode,
        note: c.note,
        original: { kind: c.kind, title: c.shouldHave },
        actionClass: c.actionClass,
      },
    }) === id,
  );
  const incidentHits = asArray(closedInterventions).filter((c) =>
    inferActionClass({
      correction: {
        reasonCode: c.rootCause,
        note: c.note,
        original: { kind: c.kind },
        actionClass: c.actionClass,
      },
    }) === id
    || (id === "new_prospect_outbound" && ["rft_exception", "approval_backlog", "low_confidence"].includes(String(c.kind))),
  );

  let approvals = 0;
  let edits = 0;
  let rejects = 0;
  let criticalIncidents = 0;

  for (const c of relevant) {
    const code = String(c.reasonCode ?? "");
    if (isCriticalReason(code)) criticalIncidents += 1;
    if (code === "rejected_outright" || String(c.decision ?? "").toUpperCase() === "REJECTED") {
      rejects += 1;
      continue;
    }
    if (isEditReason(code)) {
      edits += 1;
      continue;
    }
    if (isCleanApproval(code, c.decision)) {
      approvals += 1;
      continue;
    }
    // Unknown classified as edit for safety (default deny bias)
    edits += 1;
  }

  // Shadow corrections always count as edits for the class
  edits += shadowHits.length;
  for (const hit of incidentHits) {
    if (isCriticalReason(hit.rootCause)) criticalIncidents += 1;
  }

  const decisions = approvals + edits + rejects;
  const approvalRate = decisions > 0 ? approvals / decisions : 0;
  const editRate = decisions > 0 ? edits / decisions : 1; // no data → assume bad

  return deepFreeze({
    classId: id,
    sampleSize: decisions,
    approvals,
    edits,
    rejects,
    criticalIncidents,
    approvalRate,
    editRate,
    shadowCorrectionCount: shadowHits.length,
    incidentCount: incidentHits.length,
  });
}

/**
 * Plan 7 prerequisites for elevating any class to auto.
 * Reads launch/replay from installation config (no import cycle with rftReplay).
 */
export function plan7AutonomyGates(installation = null) {
  const launch = installation?.configuration?.rftLaunch ?? {};
  const replay = installation?.configuration?.rftReplay ?? {};
  const replayOk = Boolean(launch.replayPassedAt) || Boolean(replay.lastReplay?.passed);
  const shadowOk = Boolean(launch.shadowPassedAt) || Boolean(replay.shadow?.passed);
  const goLiveOk = Boolean(launch.goLiveAt);
  const passed = replayOk && shadowOk;
  const reasons = [];
  if (!replayOk) reasons.push("replay_not_passed");
  if (!shadowOk) reasons.push("shadow_not_passed");
  return deepFreeze({
    passed,
    goLiveOk,
    replayOk,
    shadowOk,
    reasons,
  });
}

/**
 * Evaluate one class — default deny.
 */
export function evaluateClassEligibility({
  classId,
  installation = null,
  autonomyState = null,
  contract = null,
  nowISO = null,
} = {}) {
  const meta = actionClassById(classId);
  if (!meta) {
    return deepFreeze({
      classId: String(classId),
      status: "unknown_class",
      autoEligible: false,
      metrics: null,
      reasons: ["unknown_action_class"],
    });
  }

  const at = nowISO ?? new Date().toISOString();
  const interventions = readOperatorInterventions(installation);
  const replayShadow = installation?.configuration?.rftReplay?.shadow ?? {};
  const rft = normalizeRftServiceStandard(contract?.rft ?? contract ?? null);
  const autonomy = autonomyState ?? readEarnedAutonomy(installation);
  const prior = autonomy.classes[meta.id] ?? null;

  const metrics = computeClassMetrics({
    classId: meta.id,
    corrections: readCorrections(installation),
    shadowCorrections: asArray(replayShadow.corrections),
    closedInterventions: interventions.closed,
  });

  const gates = plan7AutonomyGates(installation);
  const reasons = [];
  let status = "ineligible";

  // Risk floor: critical classes never auto in this plan without extreme bar (still require delegation)
  if (meta.risk === "critical") {
    reasons.push("critical_risk_tier");
  }

  // Contract floor for high-risk outbound
  if (meta.id === "new_prospect_outbound" && rft.approvalRules.newProspectOutboundRequiresApproval) {
    // Can still earn if metrics + delegation pass — floor is noted, not hard-block alone
    reasons.push("contract_requires_new_prospect_approval_until_earned");
  }

  if (!gates.passed) {
    reasons.push(...gates.reasons);
  }
  if (metrics.sampleSize < MIN_SAMPLE) {
    reasons.push(`insufficient_sample:${metrics.sampleSize}/${MIN_SAMPLE}`);
  }
  if (metrics.approvalRate < MIN_APPROVAL_RATE) {
    reasons.push(`approval_rate_below_threshold:${(metrics.approvalRate * 100).toFixed(0)}%`);
  }
  if (metrics.editRate > MAX_EDIT_RATE) {
    reasons.push(`edit_rate_above_threshold:${(metrics.editRate * 100).toFixed(0)}%`);
  }
  if (metrics.criticalIncidents > 0) {
    reasons.push(`critical_incidents:${metrics.criticalIncidents}`);
  }
  if (meta.risk === "critical" && metrics.criticalIncidents === 0 && metrics.sampleSize >= MIN_SAMPLE) {
    // pricing still blocked unless approval rate is near-perfect and edit rate 0
    if (metrics.approvalRate < 0.97 || metrics.editRate > 0) {
      reasons.push("critical_class_stricter_bar");
    }
  }

  const metricsPass = gates.passed
    && metrics.sampleSize >= MIN_SAMPLE
    && metrics.approvalRate >= MIN_APPROVAL_RATE
    && metrics.editRate <= MAX_EDIT_RATE
    && metrics.criticalIncidents === 0
    && !(meta.risk === "critical" && (metrics.approvalRate < 0.97 || metrics.editRate > 0));

  const policyHash = rft.contentHash ?? null;
  const policyVersion = rft.contractVersion ?? null;
  const delegated = Boolean(prior?.delegatedAt) && !prior?.revokedAt;
  const policyMatch = delegated
    && prior?.earnedAtPolicyHash
    && policyHash
    && String(prior.earnedAtPolicyHash) === String(policyHash);

  if (prior?.revokedAt) {
    reasons.push("owner_revoked");
  }
  if (delegated && !policyMatch) {
    reasons.push("policy_version_changed_reearn_required");
  }
  if (!delegated) {
    reasons.push("delegation_required");
  }

  if (metricsPass && delegated && policyMatch) {
    status = "auto_eligible";
  } else if (metricsPass && !delegated) {
    status = "eligible_pending_delegation";
    // strip soft notes that aren't blockers for pending
  } else if (metricsPass && delegated && !policyMatch) {
    status = "eligible_pending_delegation";
  } else {
    status = "ineligible";
  }

  const autoEligible = status === "auto_eligible";

  return deepFreeze({
    classId: meta.id,
    label: meta.label,
    risk: meta.risk,
    description: meta.description,
    status,
    autoEligible,
    metrics,
    gates,
    policyHash,
    policyVersion,
    delegatedAt: prior?.delegatedAt ?? null,
    revokedAt: prior?.revokedAt ?? null,
    reasons: [...new Set(reasons)],
    evaluatedAt: at,
  });
}

/**
 * Evaluate all catalog classes + merge snapshot into state.classes lastStatus.
 */
export function evaluateAllClasses({
  installation = null,
  contract = null,
  nowISO = null,
} = {}) {
  const autonomy = readEarnedAutonomy(installation);
  const at = nowISO ?? new Date().toISOString();
  const evaluations = RFT_ACTION_CLASSES.map((c) =>
    evaluateClassEligibility({
      classId: c.id,
      installation,
      autonomyState: autonomy,
      contract,
      nowISO: at,
    }),
  );

  const classes = { ...autonomy.classes };
  for (const ev of evaluations) {
    const prior = classes[ev.classId] ?? {};
    classes[ev.classId] = {
      ...prior,
      classId: ev.classId,
      lastEvaluatedAt: at,
      lastMetrics: ev.metrics,
      lastStatus: ev.status,
      lastReasons: ev.reasons,
    };
  }

  return deepFreeze({
    state: {
      version: EARNED_AUTONOMY_VERSION,
      classes,
      updatedAt: at,
    },
    evaluations,
  });
}

/**
 * Owner opt-in for a class that already passes metrics + Plan 7.
 */
export function delegateClass(state, {
  classId,
  actorId = "owner",
  policyHash = null,
  contractVersion = null,
  evaluation = null,
  nowISO = null,
} = {}) {
  const prior = readEarnedAutonomy({ configuration: { rftAutonomy: state } });
  const meta = actionClassById(classId);
  if (!meta) {
    return { ok: false, code: "unknown_class", message: "Unknown action class.", state: prior };
  }
  if (evaluation && evaluation.status === "ineligible") {
    return {
      ok: false,
      code: "not_eligible",
      message: "Class does not meet rate/evidence/Plan 7 thresholds yet.",
      reasons: evaluation.reasons,
      state: prior,
    };
  }
  if (evaluation && !["eligible_pending_delegation", "auto_eligible"].includes(evaluation.status)
    && evaluation.metrics
    && (
      evaluation.metrics.sampleSize < MIN_SAMPLE
      || evaluation.metrics.editRate > MAX_EDIT_RATE
      || evaluation.metrics.approvalRate < MIN_APPROVAL_RATE
      || evaluation.metrics.criticalIncidents > 0
      || !evaluation.gates?.passed
    )) {
    return {
      ok: false,
      code: "not_eligible",
      message: "Class does not meet rate/evidence/Plan 7 thresholds yet.",
      reasons: evaluation.reasons,
      state: prior,
    };
  }

  const at = nowISO ?? new Date().toISOString();
  const hash = policyHash ?? evaluation?.policyHash ?? null;
  if (!hash) {
    return {
      ok: false,
      code: "policy_hash_required",
      message: "Cannot delegate without an active contract content hash.",
      state: prior,
    };
  }

  const classes = {
    ...prior.classes,
    [meta.id]: {
      ...(prior.classes[meta.id] ?? {}),
      classId: meta.id,
      delegatedAt: at,
      delegatedBy: String(actorId),
      revokedAt: null,
      revokedBy: null,
      earnedAtPolicyHash: String(hash),
      earnedAtContractVersion: contractVersion ?? evaluation?.policyVersion ?? null,
      lastEvaluatedAt: evaluation?.evaluatedAt ?? at,
      lastMetrics: evaluation?.metrics ?? prior.classes[meta.id]?.lastMetrics ?? null,
      lastStatus: "auto_eligible",
      lastReasons: [],
    },
  };

  return {
    ok: true,
    state: deepFreeze({
      version: EARNED_AUTONOMY_VERSION,
      classes,
      updatedAt: at,
    }),
  };
}

export function revokeClass(state, {
  classId,
  actorId = "owner",
  nowISO = null,
  note = null,
} = {}) {
  const prior = readEarnedAutonomy({ configuration: { rftAutonomy: state } });
  const meta = actionClassById(classId);
  if (!meta) {
    return { ok: false, code: "unknown_class", message: "Unknown action class.", state: prior };
  }
  const at = nowISO ?? new Date().toISOString();
  const prev = prior.classes[meta.id] ?? { classId: meta.id };
  const classes = {
    ...prior.classes,
    [meta.id]: {
      ...prev,
      revokedAt: at,
      revokedBy: String(actorId),
      delegatedAt: null,
      delegatedBy: null,
      lastStatus: "ineligible",
      lastReasons: ["owner_revoked", note].filter(Boolean),
    },
  };
  return {
    ok: true,
    state: deepFreeze({
      version: EARNED_AUTONOMY_VERSION,
      classes,
      updatedAt: at,
    }),
  };
}

export function isClassAutoEligible(installationOrState, classId) {
  // Accept full installation or evaluations snapshot via evaluate
  if (installationOrState?.configuration || installationOrState?.businessId) {
    const ev = evaluateClassEligibility({
      classId,
      installation: installationOrState,
    });
    return ev.autoEligible;
  }
  const autonomy = readEarnedAutonomy({ configuration: { rftAutonomy: installationOrState } });
  const row = autonomy.classes[String(classId)];
  return row?.lastStatus === "auto_eligible" && Boolean(row.delegatedAt) && !row.revokedAt;
}

/**
 * Resolve ApprovalRequired vs AutoEligible for an opportunity event.
 */
export function resolveAutonomyDisposition({
  event = null,
  contract = null,
  installation = null,
  title = null,
} = {}) {
  const classId = inferActionClass({ event, title });
  const evaluation = evaluateClassEligibility({
    classId,
    installation,
    contract,
  });
  return deepFreeze({
    classId,
    evaluation,
    autoEligible: evaluation.autoEligible,
    proposedNextState: evaluation.autoEligible ? "AutoEligible" : "ApprovalRequired",
  });
}

export async function persistEarnedAutonomy({
  platformStore,
  installation,
  state,
  actorId = "earned_autonomy",
} = {}) {
  if (!platformStore || !installation) return null;
  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "earned_autonomy",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    configuration: {
      ...(installation.configuration ?? {}),
      rftAutonomy: state,
    },
    installedAt: installation.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
  return state;
}
