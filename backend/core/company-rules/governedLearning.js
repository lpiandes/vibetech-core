/**
 * Plan 10 — Governed learning loop.
 * Capture original vs approved, classify, detect repeats, propose Company Rules,
 * version + rollback. Never silent auto-apply.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  OPERATOR_ROOT_CAUSES,
  OPERATOR_ROOT_CAUSE_LABELS,
  normalizeRootCause,
} from "../admin/operatorRootCause.js";
import { readOperatorInterventions } from "../admin/operatorInterventions.js";
import { normalizeRftServiceStandard } from "../ai-builder/operating-contract/rft/rftContract.js";
import { readRftReplay, runHistoricalReplay } from "../ai-builder/operating-contract/rft/rftReplay.js";

export const GOVERNED_LEARNING_VERSION = 1;
export const REPEAT_THRESHOLD = 3;

export const EDIT_REASON_CODES = Object.freeze([
  ...OPERATOR_ROOT_CAUSES,
  "owner_preference",
  "tone_edit",
  "facts_corrected",
  "timing_change",
  "scope_change",
  "rejected_outright",
  "approved_as_proposed",
]);

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

export function readGovernedLearning(installation = null) {
  const raw = installation?.configuration?.governedLearning;
  if (!raw || typeof raw !== "object") {
    return {
      version: GOVERNED_LEARNING_VERSION,
      corrections: [],
      proposals: [],
      ruleVersions: [],
      updatedAt: null,
    };
  }
  return {
    version: Number(raw.version) || GOVERNED_LEARNING_VERSION,
    corrections: asArray(raw.corrections),
    proposals: asArray(raw.proposals),
    ruleVersions: asArray(raw.ruleVersions),
    updatedAt: raw.updatedAt ?? null,
  };
}

export function normalizeEditReason(value) {
  const code = String(value ?? "").trim().toLowerCase();
  if (EDIT_REASON_CODES.includes(code)) return code;
  const root = normalizeRootCause(code);
  return root || null;
}

/**
 * Append a correction (original vs outcome). Idempotent by correctionId.
 */
export function recordCorrection(state, correction = {}, { nowISO = null } = {}) {
  const at = nowISO ?? new Date().toISOString();
  const reason = normalizeEditReason(correction.reasonCode ?? correction.rootCause);
  if (!reason) {
    return {
      ok: false,
      code: "reason_required",
      message: "Correction requires a reason code (root cause or edit reason).",
      allowed: [...EDIT_REASON_CODES],
      state: readGovernedLearning({ configuration: { governedLearning: state } }),
    };
  }

  const id = String(
    correction.correctionId
    ?? correction.id
    ?? `corr_${reason}_${Date.now().toString(36)}`,
  );
  const prior = readGovernedLearning({ configuration: { governedLearning: state } });
  if (prior.corrections.some((c) => String(c.correctionId) === id)) {
    return { ok: true, duplicate: true, state: deepFreeze(prior), correctionId: id };
  }

  const entry = deepFreeze({
    correctionId: id,
    at,
    source: String(correction.source ?? "unknown"),
    reasonCode: reason,
    reasonLabel: OPERATOR_ROOT_CAUSE_LABELS[reason]
      ?? reason.replace(/_/g, " "),
    original: correction.original ?? null,
    approved: correction.approved ?? null,
    decision: correction.decision ? String(correction.decision).toUpperCase() : null,
    policy: {
      contractVersion: correction.contractVersion ?? correction.policy?.contractVersion ?? null,
      contentHash: correction.contentHash ?? correction.policy?.contentHash ?? null,
      employeeId: correction.employeeId ?? correction.policy?.employeeId ?? null,
      ruleVersion: correction.ruleVersion ?? correction.policy?.ruleVersion ?? null,
    },
    evidence: asArray(correction.evidence).filter((e) => e?.providerId),
    note: correction.note ? String(correction.note).slice(0, 2000) : null,
    actorId: correction.actorId ? String(correction.actorId) : null,
  });

  const next = {
    ...prior,
    corrections: [entry, ...prior.corrections].slice(0, 500),
    updatedAt: at,
  };
  return { ok: true, correction: entry, state: deepFreeze(next) };
}

/**
 * Count corrections by reasonCode; propose when threshold met and no open proposal.
 */
export function detectRepeatsAndPropose(state, {
  threshold = REPEAT_THRESHOLD,
  nowISO = null,
  contract = null,
} = {}) {
  const prior = readGovernedLearning({ configuration: { governedLearning: state } });
  const at = nowISO ?? new Date().toISOString();
  const counts = {};
  const byReason = {};
  for (const c of prior.corrections) {
    const code = String(c.reasonCode ?? "");
    if (!code) continue;
    counts[code] = (counts[code] ?? 0) + 1;
    if (!byReason[code]) byReason[code] = [];
    byReason[code].push(c);
  }

  const proposals = [...prior.proposals];
  const created = [];
  for (const [reasonCode, count] of Object.entries(counts)) {
    if (count < threshold) continue;
    const openExists = proposals.some((p) =>
      p.reasonCode === reasonCode && (p.status === "proposed" || p.status === "awaiting_replay"),
    );
    const alreadyApproved = prior.ruleVersions.some((v) =>
      v.reasonCode === reasonCode && v.status === "active",
    );
    if (openExists || alreadyApproved) continue;

    const samples = (byReason[reasonCode] ?? []).slice(0, 5);
    const rft = normalizeRftServiceStandard(contract?.rft ?? contract ?? null);
    const proposalId = `prop_${reasonCode}_${at.replace(/[^0-9]/g, "").slice(0, 14)}`;
    const proposal = deepFreeze({
      proposalId,
      status: "proposed",
      reasonCode,
      reasonLabel: OPERATOR_ROOT_CAUSE_LABELS[reasonCode] ?? reasonCode.replace(/_/g, " "),
      correctionCount: count,
      createdAt: at,
      evidence: samples.flatMap((s) => asArray(s.evidence)).slice(0, 20),
      sampleCorrectionIds: samples.map((s) => s.correctionId),
      suggestedPatch: suggestPatchForReason(reasonCode, rft),
      policy: {
        contractVersion: rft.contractVersion,
        contentHash: rft.contentHash,
      },
      replay: null,
      note: `Proposed after ${count} corrections classified as ${reasonCode}. Owner must approve — never auto-applied.`,
    });
    proposals.unshift(proposal);
    created.push(proposal);
  }

  return deepFreeze({
    state: {
      ...prior,
      proposals: proposals.slice(0, 100),
      updatedAt: at,
    },
    created,
    counts,
  });
}

function suggestPatchForReason(reasonCode, rft) {
  switch (reasonCode) {
    case "missing_business_rule":
    case "incorrect_classification":
      return {
        kind: "company_rule_text",
        title: `Clarify handling for ${reasonCode.replace(/_/g, " ")}`,
        body: `When this class of correction repeats, require an explicit Company Rule before auto-progressing similar opportunities.`,
      };
    case "customer_delay":
      return {
        kind: "rft_patch",
        patch: {
          rft: {
            sla: {
              acknowledgeWithinMinutes: rft.sla.acknowledgeWithinMinutes,
              proposalReviewCadenceDays: Math.max(1, Number(rft.sla.proposalReviewCadenceDays) || 3),
            },
          },
        },
        title: "Tighten follow-up cadence for stalled prospects",
      };
    case "provider_failure":
    case "missing_integration":
      return {
        kind: "company_rule_text",
        title: "Require proven channel before outbound",
        body: "Do not mark Verified or auto-send until the required integration is Proven with a provider id.",
      };
    case "ai_quality_failure":
    case "tone_edit":
    case "facts_corrected":
      return {
        kind: "rft_patch",
        patch: {
          rft: {
            approvalRules: {
              ...rft.approvalRules,
              customerFacingRequiresApproval: true,
            },
          },
        },
        title: "Keep customer-facing on approval until quality improves",
      };
    default:
      return {
        kind: "company_rule_text",
        title: `Policy note: ${reasonCode.replace(/_/g, " ")}`,
        body: `Document the preferred handling for repeated “${reasonCode}” corrections.`,
      };
  }
}

/**
 * Attach replay result before owner can approve enable.
 */
export function attachReplayToProposal(state, proposalId, replayResult, { nowISO = null } = {}) {
  const prior = readGovernedLearning({ configuration: { governedLearning: state } });
  const at = nowISO ?? new Date().toISOString();
  const id = String(proposalId ?? "");
  const proposals = prior.proposals.map((p) => {
    if (String(p.proposalId) !== id) return p;
    return {
      ...p,
      status: replayResult?.passed ? "awaiting_approval" : "awaiting_replay",
      replay: {
        ranAt: replayResult?.ranAt ?? at,
        passed: Boolean(replayResult?.passed),
        passDetail: replayResult?.passDetail ?? null,
        summary: replayResult?.summary ?? null,
      },
    };
  });
  return deepFreeze({
    ...prior,
    proposals,
    updatedAt: at,
  });
}

/**
 * Owner approves a proposal → new rule version (active). Prior active for same reason superseded.
 */
export function approveProposal(state, {
  proposalId,
  actorId = "owner",
  nowISO = null,
  requireReplayPass = true,
} = {}) {
  const prior = readGovernedLearning({ configuration: { governedLearning: state } });
  const at = nowISO ?? new Date().toISOString();
  const proposal = prior.proposals.find((p) => String(p.proposalId) === String(proposalId));
  if (!proposal) {
    return { ok: false, code: "proposal_not_found", message: "Proposal not found.", state: prior };
  }
  if (proposal.status === "rejected" || proposal.status === "approved") {
    return { ok: false, code: "proposal_closed", message: `Proposal already ${proposal.status}.`, state: prior };
  }
  if (requireReplayPass && !proposal.replay?.passed) {
    return {
      ok: false,
      code: "replay_required",
      message: "Run historical replay and pass before approving this Company Rule.",
      state: prior,
    };
  }

  const version = (prior.ruleVersions[0]?.version ?? 0) + 1;
  const rule = deepFreeze({
    ruleId: `rule_${proposal.reasonCode}_v${version}`,
    version,
    status: "active",
    reasonCode: proposal.reasonCode,
    title: proposal.suggestedPatch?.title ?? proposal.reasonLabel,
    body: proposal.suggestedPatch?.body ?? proposal.note,
    suggestedPatch: proposal.suggestedPatch,
    proposalId: proposal.proposalId,
    approvedAt: at,
    approvedBy: String(actorId),
    policy: proposal.policy,
    evidence: proposal.evidence,
    previousVersion: prior.ruleVersions.find((v) => v.status === "active" && v.reasonCode === proposal.reasonCode)?.version
      ?? null,
  });

  const ruleVersions = [
    rule,
    ...prior.ruleVersions.map((v) => (
      v.reasonCode === proposal.reasonCode && v.status === "active"
        ? { ...v, status: "superseded", supersededAt: at, supersededBy: rule.ruleId }
        : v
    )),
  ].slice(0, 100);

  const proposals = prior.proposals.map((p) => (
    String(p.proposalId) === String(proposalId)
      ? { ...p, status: "approved", approvedAt: at }
      : p
  ));

  return {
    ok: true,
    rule,
    state: deepFreeze({
      ...prior,
      proposals,
      ruleVersions,
      updatedAt: at,
    }),
  };
}

export function rejectProposal(state, { proposalId, actorId = "owner", nowISO = null, note = null } = {}) {
  const prior = readGovernedLearning({ configuration: { governedLearning: state } });
  const at = nowISO ?? new Date().toISOString();
  const proposals = prior.proposals.map((p) => (
    String(p.proposalId) === String(proposalId)
      ? {
        ...p,
        status: "rejected",
        rejectedAt: at,
        rejectedBy: String(actorId),
        rejectNote: note ? String(note).slice(0, 500) : null,
      }
      : p
  ));
  return deepFreeze({
    ...prior,
    proposals,
    updatedAt: at,
  });
}

/**
 * Rollback active rule to previous version for that reasonCode (or deactivate).
 */
export function rollbackRule(state, { ruleId = null, reasonCode = null, actorId = "owner", nowISO = null } = {}) {
  const prior = readGovernedLearning({ configuration: { governedLearning: state } });
  const at = nowISO ?? new Date().toISOString();
  const active = prior.ruleVersions.find((v) =>
    v.status === "active"
    && (ruleId ? String(v.ruleId) === String(ruleId) : true)
    && (reasonCode ? v.reasonCode === reasonCode : true),
  );
  if (!active) {
    return { ok: false, code: "no_active_rule", message: "No active rule to roll back.", state: prior };
  }

  const previous = prior.ruleVersions.find((v) =>
    v.reasonCode === active.reasonCode
    && v.status === "superseded"
    && Number(v.version) === Number(active.previousVersion),
  ) ?? prior.ruleVersions.find((v) =>
    v.reasonCode === active.reasonCode
    && v.status === "superseded"
    && Number(v.version) < Number(active.version),
  );

  const ruleVersions = prior.ruleVersions.map((v) => {
    if (String(v.ruleId) === String(active.ruleId)) {
      return {
        ...v,
        status: "rolled_back",
        rolledBackAt: at,
        rolledBackBy: String(actorId),
      };
    }
    if (previous && String(v.ruleId) === String(previous.ruleId)) {
      return {
        ...v,
        status: "active",
        restoredAt: at,
        restoredBy: String(actorId),
      };
    }
    return v;
  });

  // If no previous, active is just deactivated (honest empty prior).
  return {
    ok: true,
    restored: previous
      ? { ...previous, status: "active" }
      : null,
    deactivated: active.ruleId,
    state: deepFreeze({
      ...prior,
      ruleVersions,
      updatedAt: at,
    }),
  };
}

/**
 * Ingest Plan 7/8 feeds into corrections (idempotent).
 */
export function ingestExternalFeeds(state, { installation = null, nowISO = null } = {}) {
  let working = readGovernedLearning({ configuration: { governedLearning: state } });
  const interventions = readOperatorInterventions(installation);
  for (const closed of interventions.closed) {
    const recorded = recordCorrection(working, {
      correctionId: `op_${closed.caseId}`,
      source: "operator_intervention",
      reasonCode: closed.rootCause,
      original: { caseId: closed.caseId, kind: closed.kind },
      approved: { note: closed.note, closedAt: closed.closedAt },
      decision: "RESOLVED",
      note: closed.note,
      actorId: closed.actorId,
      evidence: [{ kind: "operator_case_id", providerId: String(closed.caseId) }],
    }, { nowISO: closed.closedAt ?? nowISO });
    if (recorded.ok) working = recorded.state;
  }

  const replay = readRftReplay(installation);
  for (const corr of asArray(replay.shadow?.corrections)) {
    const id = `shadow_${corr.proposalId ?? corr.at ?? Math.random().toString(36).slice(2)}`;
    const recorded = recordCorrection(working, {
      correctionId: id,
      source: "shadow_correction",
      reasonCode: corr.reasonCode ?? "owner_preference",
      original: { proposalId: corr.proposalId, shouldHave: null },
      approved: { shouldHave: corr.shouldHave, note: corr.note },
      decision: "CORRECTED",
      note: corr.note,
      evidence: corr.proposalId
        ? [{ kind: "shadow_proposal_id", providerId: String(corr.proposalId) }]
        : [],
    }, { nowISO: corr.at ?? nowISO });
    if (recorded.ok) working = recorded.state;
  }

  return working;
}

export async function persistGovernedLearning({
  platformStore,
  installation,
  state,
  actorId = "governed_learning",
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
      ?? "governed_learning",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    configuration: {
      ...(installation.configuration ?? {}),
      governedLearning: state,
    },
    installedAt: installation.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: actorId,
  });
  return state;
}

/**
 * Full refresh: ingest feeds → propose from repeats.
 */
export function refreshGovernedLearning(installation, { contract = null, nowISO = null } = {}) {
  let state = readGovernedLearning(installation);
  state = ingestExternalFeeds(state, { installation, nowISO });
  const employee = asArray(installation?.configuration?.employees).find((e) =>
    e?.operatingContract?.rft,
  );
  const detected = detectRepeatsAndPropose(state, {
    threshold: REPEAT_THRESHOLD,
    nowISO,
    contract: contract ?? employee?.operatingContract ?? null,
  });
  return detected;
}

export function runProposalReplay(installation, proposalId, { contract = null } = {}) {
  const state = readGovernedLearning(installation);
  const proposal = state.proposals.find((p) => String(p.proposalId) === String(proposalId));
  if (!proposal) {
    return { ok: false, code: "proposal_not_found", message: "Proposal not found." };
  }
  const employee = asArray(installation?.configuration?.employees).find((e) =>
    e?.operatingContract?.rft,
  );
  const replay = runHistoricalReplay({
    installation,
    contract: contract ?? employee?.operatingContract ?? null,
  });
  const next = attachReplayToProposal(state, proposalId, replay);
  return { ok: true, replay, state: next };
}

export { OPERATOR_ROOT_CAUSE_LABELS };
