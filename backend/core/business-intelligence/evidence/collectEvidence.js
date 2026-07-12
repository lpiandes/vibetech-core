import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { assertEvidenceTenant } from "../evidence/EvidenceReference.js";

/**
 * Declarative evidence selector runner.
 * Selectors describe which canonical collections/fields to inspect.
 */
export function collectEvidence({
  stack,
  businessId,
  selectors = [],
  nowISO = new Date().toISOString(),
} = {}) {
  const collected = [];
  const missing = [];

  for (const selector of selectors) {
    const collection = resolveCollection(stack, selector.collection);
    if (!collection) {
      missing.push(`${selector.collection}:unavailable`);
      continue;
    }
    const items = typeof collection === "function" ? collection() : collection;
    const filtered = (items ?? []).filter((item) => matchFilters(item, selector.filters ?? {}));
    if (!filtered.length) {
      missing.push(`${selector.collection}:no_match`);
      continue;
    }
    for (const item of filtered) {
      collected.push(deepFreeze({
        objectType: String(selector.objectType),
        objectId: String(item[selector.idField ?? "id"]),
        businessId: String(businessId),
        field: selector.field ?? null,
        observedValue: selector.field ? item[selector.field] ?? null : null,
        comparison: selector.comparison ?? null,
        threshold: selector.threshold ?? null,
        observedAt: nowISO,
        explanation: String(selector.explanation
          ?? `Observed ${selector.objectType} ${item[selector.idField ?? "id"]}`),
      }));
    }
  }

  assertEvidenceTenant(collected, businessId);
  return deepFreeze({ evidence: collected, missingEvidence: missing });
}

function resolveCollection(stack, collection) {
  switch (String(collection)) {
    case "requests":
      return () => stack.requestRuntime?.getRequests?.() ?? [];
    case "work":
      return () => stack.workRuntime?.getWorkItems?.() ?? [];
    case "interactions":
      return () => stack.interactionRuntime?.getInteractions?.() ?? [];
    case "parties":
      return () => stack.businessGraphRuntime?.getParties?.() ?? [];
    case "relationships":
      return () => stack.businessGraphRuntime?.listRelationships?.()
        ?? stack.businessGraphRuntime?.getRelationships?.()
        ?? [];
    case "subjects":
      return () => stack.businessSubjectRuntime?.getSubjects?.() ?? [];
    case "approvals":
      return () => stack.approvalRuntime?.getRequests?.() ?? [];
    default:
      return null;
  }
}

function matchFilters(item, filters) {
  for (const [key, expected] of Object.entries(filters)) {
    if (expected && typeof expected === "object" && !Array.isArray(expected)) {
      if (expected.$in && !expected.$in.map(String).includes(String(item[key]))) return false;
      if (expected.$eq != null && String(item[key]) !== String(expected.$eq)) return false;
      if (expected.$null === true && item[key] != null && item[key] !== "") return false;
      continue;
    }
    if (String(item[key]) !== String(expected)) return false;
  }
  return true;
}
