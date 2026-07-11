import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Business DNA — human-readable understanding of a business.
 * Not the runtime. Not the Business OS Specification.
 */
export function createBusinessDna({
  dnaId = null,
  businessId = null,
  company = {},
  services = [],
  customers = [],
  departments = [],
  team = [],
  workflows = [],
  approvals = [],
  recurringWork = [],
  terminology = {},
  integrations = [],
  kpis = [],
  policies = [],
  goals = [],
  constraints = [],
  confidence = {},
  unresolvedQuestions = [],
  sourceSessionId = null,
  createdAt = new Date().toISOString(),
  updatedAt = null,
} = {}) {
  const dna = {
    dnaId: String(dnaId ?? `dna_${Date.now()}`),
    businessId: businessId == null ? null : String(businessId),
    company: freezeObject(company),
    services: freezeArray(services),
    customers: freezeArray(customers),
    departments: freezeArray(departments),
    team: freezeArray(team),
    workflows: freezeArray(workflows),
    approvals: freezeArray(approvals),
    recurringWork: freezeArray(recurringWork),
    terminology: freezeObject(terminology),
    integrations: freezeArray(integrations),
    kpis: freezeArray(kpis),
    policies: freezeArray(policies),
    goals: freezeArray(goals),
    constraints: freezeArray(constraints),
    confidence: freezeObject(confidence),
    unresolvedQuestions: freezeArray(unresolvedQuestions),
    sourceSessionId: sourceSessionId == null ? null : String(sourceSessionId),
    createdAt: String(createdAt),
    updatedAt: updatedAt == null ? String(createdAt) : String(updatedAt),
    contract: "BusinessDna/v1",
  };
  return deepFreeze(dna);
}

export function validateBusinessDna(dna) {
  const errors = [];
  if (!dna || typeof dna !== "object") {
    return deepFreeze({ ok: false, errors: ["dna_required"] });
  }
  if (dna.contract !== "BusinessDna/v1") errors.push("invalid_contract");
  if (!dna.dnaId) errors.push("dnaId_required");
  if (!dna.company || typeof dna.company !== "object") errors.push("company_required");
  for (const field of [
    "services", "customers", "departments", "team", "workflows", "approvals",
    "recurringWork", "integrations", "kpis", "policies", "goals", "constraints",
    "unresolvedQuestions",
  ]) {
    if (!Array.isArray(dna[field])) errors.push(`${field}_must_be_array`);
  }
  if (!dna.terminology || typeof dna.terminology !== "object" || Array.isArray(dna.terminology)) {
    errors.push("terminology_must_be_object");
  }
  return deepFreeze({ ok: errors.length === 0, errors });
}

export function businessDnaFromSummary(businessSummary = {}, { dnaId, businessId, sourceSessionId } = {}) {
  return createBusinessDna({
    dnaId,
    businessId,
    sourceSessionId,
    company: {
      name: businessSummary.businessName ?? null,
      industry: businessSummary.industry ?? null,
      description: businessSummary.description ?? null,
      locations: businessSummary.locations ?? [],
    },
    services: asNamedList(businessSummary.services),
    customers: asNamedList(businessSummary.customerTypes ?? businessSummary.customers),
    team: asNamedList(businessSummary.roles),
    approvals: asNamedList(businessSummary.approvalNeeds),
    terminology: businessSummary.terminology ?? {},
    integrations: asNamedList(businessSummary.currentSoftware ?? businessSummary.integrations),
    goals: asNamedList(businessSummary.desiredOutcomes),
    constraints: asNamedList(businessSummary.painPoints),
    unresolvedQuestions: businessSummary.unresolvedQuestions ?? [],
    confidence: {
      overall: businessSummary.industry ? "medium" : "low",
    },
  });
}

function asNamedList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((entry) => (
      entry && typeof entry === "object" ? entry : { label: String(entry) }
    ));
  }
  return [{ label: String(value) }];
}

function freezeObject(value) {
  return deepFreeze(value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {});
}

function freezeArray(value) {
  return deepFreeze(Array.isArray(value) ? value.map((entry) => (
    entry && typeof entry === "object" ? deepFreeze({ ...entry }) : entry
  )) : []);
}
