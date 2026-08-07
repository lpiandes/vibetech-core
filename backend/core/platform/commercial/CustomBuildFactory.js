/**
 * Custom Build Factory — pure state machine for delivery engagements.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { getCommercialOffer } from "./CommercialOfferMatrix.js";
import { getPlaybook } from "./DeliveryPlaybookRegistry.js";

export const CUSTOM_BUILD_STEPS = deepFreeze([
  { id: "intake", label: "Intake brief" },
  { id: "scope", label: "Scope entitlements" },
  { id: "architect", label: "Architect / Package Ask" },
  { id: "install", label: "Install workers & workflows" },
  { id: "prove", label: "Prove missions" },
  { id: "acceptance", label: "Acceptance checklist" },
  { id: "go_live", label: "Go live" },
  { id: "handoff", label: "Handoff" },
]);

const STEP_IDS = CUSTOM_BUILD_STEPS.map((s) => s.id);

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

  if (id === "go_live" && !record.stepStatus?.acceptance?.done) {
    throw new Error("acceptance required before go_live");
  }
  if (id === "go_live" && !record.stepStatus?.prove?.done) {
    throw new Error("prove required before go_live");
  }

  const now = meta.at ?? new Date().toISOString();
  const stepStatus = { ...record.stepStatus };
  stepStatus[id] = {
    done: true,
    at: now,
    evidence: meta.evidence ?? record.stepStatus[id]?.evidence ?? null,
  };

  return deepFreeze({
    ...record,
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
      canGoLive: Boolean(record.stepStatus?.acceptance?.done && record.stepStatus?.prove?.done),
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
}
