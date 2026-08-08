/**
 * Custom Build Factory — pure state machine for delivery engagements.
 * Prove + go-live require real mission evidence (not operator "Mark done").
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { getCommercialOffer } from "./CommercialOfferMatrix.js";
import { getPlaybook } from "./DeliveryPlaybookRegistry.js";

export const CUSTOM_BUILD_STEPS = deepFreeze([
  { id: "intake", label: "Tell us what you need" },
  { id: "scope", label: "Confirm what’s included" },
  { id: "architect", label: "Answer a few setup questions" },
  { id: "install", label: "Install workers & workflows" },
  { id: "prove", label: "Test that it works" },
  { id: "acceptance", label: "Accept the checklist" },
  { id: "go_live", label: "Go live" },
  { id: "handoff", label: "Handoff" },
]);

const STEP_IDS = CUSTOM_BUILD_STEPS.map((s) => s.id);

const INTAKE_REQUIRED_KEYS = ["industry", "outcome", "channels"];

/**
 * @param {{ businessId: string, sheetLine?: string, offerId?: string, packageIds?: string[], brief?: Record<string, unknown> }} input
 */
export function createCustomBuildRecord(input = {}) {
  const businessId = String(input.businessId ?? "").trim();
  if (!businessId) throw new Error("businessId required");

  const offer = input.offerId
    ? getCommercialOffer(input.offerId)
    : input.sheetLine
      ? getCommercialOffer(input.sheetLine)
      : null;

  const sheetLine = offer?.sheetLine ?? String(input.sheetLine ?? "Custom AI Application");
  const packageIds = Array.isArray(input.packageIds)
    ? input.packageIds.map(String)
    : (offer?.packageId ? [offer.packageId] : ["ai_business_os"]);

  const now = new Date().toISOString();
  const stepStatus = {};
  for (const id of STEP_IDS) {
    stepStatus[id] = { done: false, at: null, evidence: null };
  }

  return deepFreeze({
    id: `cbf_${businessId}_${Date.now().toString(36)}`,
    businessId,
    offerId: offer?.id ?? null,
    sheetLine,
    packageIds,
    brief: input.brief && typeof input.brief === "object" ? { ...input.brief } : {},
    playbookId: offer?.deliveryPlaybookId ?? "custom_build_factory",
    requiredProveMissionIds: [...(offer?.requiredProveMissionIds ?? ["knowledge_consult", "outbound_approvals"])],
    stepStatus,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Normalize proof rows from platformStore.listCapabilityProofRecords into mission ids.
 * @param {Array<{ capabilityId?: string, ok?: boolean, verified?: boolean }>|null|undefined} proofRows
 * @param {string[]} requiredMissionIds
 */
export function provenMissionsFromProofRecords(proofRows, requiredMissionIds = []) {
  const required = new Set((requiredMissionIds ?? []).map(String));
  const proven = [];
  for (const row of Array.isArray(proofRows) ? proofRows : []) {
    const id = String(row?.capabilityId ?? "").trim();
    if (!id || !required.has(id)) continue;
    if (row?.ok === true || row?.verified === true) proven.push(id);
  }
  return [...new Set(proven)];
}

/**
 * @param {unknown} evidence
 * @param {string[]} requiredMissionIds
 */
export function assertProveEvidenceComplete(evidence, requiredMissionIds = []) {
  const required = (requiredMissionIds ?? []).map(String).filter(Boolean);
  if (!required.length) {
    return deepFreeze({ ok: true, missing: [], proven: [] });
  }
  const proven = Array.isArray(evidence?.provenMissionIds)
    ? evidence.provenMissionIds.map(String)
    : [];
  const provenSet = new Set(proven);
  const missing = required.filter((id) => !provenSet.has(id));
  return deepFreeze({
    ok: missing.length === 0,
    missing,
    proven: [...provenSet],
  });
}

function assertIntakeBrief(brief = {}) {
  const missing = INTAKE_REQUIRED_KEYS.filter((key) => {
    const value = brief?.[key];
    if (Array.isArray(value)) return value.length === 0;
    return !String(value ?? "").trim();
  });
  if (missing.length) {
    throw new Error(`intake brief incomplete — need ${missing.join(", ")}`);
  }
}

function assertAcceptanceEvidence(evidence) {
  if (evidence?.accepted === true && Array.isArray(evidence?.checklistIds) && evidence.checklistIds.length > 0) {
    return;
  }
  if (evidence?.checklist && typeof evidence.checklist === "object") {
    const entries = Object.entries(evidence.checklist);
    if (entries.length > 0 && entries.every(([, v]) => v === true)) return;
  }
  throw new Error("acceptance requires checklist evidence (accepted + checklistIds)");
}

/**
 * @param {ReturnType<typeof createCustomBuildRecord>} record
 * @param {string} stepId
 * @param {{ evidence?: unknown, at?: string }} [meta]
 */
export function advanceCustomBuild(record, stepId, meta = {}) {
  if (!record || typeof record !== "object") throw new Error("record required");
  const id = String(stepId ?? "").trim();
  if (!STEP_IDS.includes(id)) throw new Error(`unknown step: ${id}`);

  const idx = STEP_IDS.indexOf(id);
  for (let i = 0; i < idx; i += 1) {
    const prev = STEP_IDS[i];
    if (!record.stepStatus?.[prev]?.done) {
      throw new Error(`complete ${prev} before ${id}`);
    }
  }

  const evidence = meta.evidence ?? null;

  if (id === "intake") {
    const brief = {
      ...(record.brief && typeof record.brief === "object" ? record.brief : {}),
      ...(evidence?.brief && typeof evidence.brief === "object" ? evidence.brief : {}),
    };
    assertIntakeBrief(brief);
  }

  if (id === "prove") {
    const check = assertProveEvidenceComplete(evidence, record.requiredProveMissionIds);
    if (!check.ok) {
      throw new Error(`prove incomplete — missing missions: ${check.missing.join(", ")}`);
    }
  }

  if (id === "acceptance") {
    assertAcceptanceEvidence(evidence);
  }

  if (id === "go_live") {
    if (!record.stepStatus?.acceptance?.done) {
      throw new Error("acceptance required before go_live");
    }
    if (!record.stepStatus?.prove?.done) {
      throw new Error("prove required before go_live");
    }
    const proveEvidence = record.stepStatus?.prove?.evidence;
    const check = assertProveEvidenceComplete(proveEvidence, record.requiredProveMissionIds);
    if (!check.ok) {
      throw new Error(`go_live blocked — prove evidence missing: ${check.missing.join(", ")}`);
    }
  }

  const now = meta.at ?? new Date().toISOString();
  const stepStatus = { ...record.stepStatus };
  stepStatus[id] = {
    done: true,
    at: now,
    evidence: evidence ?? record.stepStatus[id]?.evidence ?? null,
  };

  let brief = record.brief;
  if (id === "intake" && evidence?.brief && typeof evidence.brief === "object") {
    brief = { ...record.brief, ...evidence.brief };
  }

  return deepFreeze({
    ...record,
    brief,
    stepStatus,
    updatedAt: now,
  });
}

export function isCustomBuildComplete(record) {
  if (!record?.stepStatus) return false;
  return STEP_IDS.every((id) => record.stepStatus[id]?.done === true);
}

export function presentCustomBuild(record) {
  if (!record) return null;
  const playbook = getPlaybook(record.playbookId);
  const steps = CUSTOM_BUILD_STEPS.map((step) => {
    const status = record.stepStatus?.[step.id] ?? { done: false, at: null, evidence: null };
    return {
      id: step.id,
      label: step.label,
      done: Boolean(status.done),
      at: status.at ?? null,
      evidence: status.evidence ?? null,
    };
  });
  const completeCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done) ?? null;
  const proveCheck = assertProveEvidenceComplete(
    record.stepStatus?.prove?.evidence,
    record.requiredProveMissionIds,
  );
  return deepFreeze({
    id: record.id,
    businessId: record.businessId,
    offerId: record.offerId,
    sheetLine: record.sheetLine,
    packageIds: record.packageIds,
    playbookId: record.playbookId,
    playbookTitle: playbook?.title ?? null,
    requiredProveMissionIds: record.requiredProveMissionIds,
    brief: record.brief,
    steps,
    summary: {
      completeCount,
      totalSteps: steps.length,
      complete: isCustomBuildComplete(record),
      nextStepId: next?.id ?? null,
      canGoLive: Boolean(
        record.stepStatus?.acceptance?.done
        && record.stepStatus?.prove?.done
        && proveCheck.ok,
      ),
      proveComplete: proveCheck.ok,
      missingProveMissionIds: proveCheck.missing,
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}
