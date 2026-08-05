/**
 * Plan 12 — Delivery → moat.
 * Extract scrubbed operating patterns from delivery; promote to BlueprintRegistry.
 * Never pool confidential customer data. Fail closed on raw PII.
 */
import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { createBlueprintDefinition } from "../blueprints/BlueprintDefinition.js";
import { RFT_ACTION_CLASSES } from "./earnedAutonomy.js";

export const DELIVERY_MOAT_VERSION = 1;
export const DELIVERY_MOAT_SOURCE = "delivery_moat";

export const PATTERN_KINDS = Object.freeze([
  "proposal_stall_follow_up",
  "ack_sla_default",
  "integration_recovery",
  "approval_boundary",
  "scheduling_autonomy_gate",
  "assignment_rule",
  "handoff_requirement",
]);

/** Fields / keys that must never appear in promoted structure. */
const FORBIDDEN_KEY_FRAGMENTS = Object.freeze([
  "email",
  "phone",
  "message",
  "note",
  "address",
  "ssn",
  "password",
  "token",
  "secret",
  "accountid",
  "providerid",
  "businessid",
  "businessname",
  "original",
  "approved",
  "payload",
  "contact",
]);

/** Keys allowed even if they contain otherwise-suspicious fragments. */
const ALLOWED_STRUCTURE_KEYS = Object.freeze(new Set([
  "rootCauseCodes",
  "evidenceKinds",
  "eventTypes",
  "rftPatchShape",
  "companyRuleShape",
  "autonomyGate",
  "titleTemplate",
  "bodyTemplate",
  "reasonCode",
  "sla",
  "approvalRules",
  "acknowledgeWithinMinutes",
  "proposalReviewCadenceDays",
  "customerFacingRequiresApproval",
  "newProspectOutboundRequiresApproval",
  "existingCustomerSchedulingMayAuto",
  "pricingOutsidePolicyRequiresApproval",
  "classId",
  "risk",
  "minSample",
  "minApprovalRate",
  "maxEditRate",
  "patternKind",
]));

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/;

let catalogState = emptyCatalog();

function emptyCatalog() {
  return {
    version: DELIVERY_MOAT_VERSION,
    candidates: [],
    published: [],
    updatedAt: null,
  };
}

function asArray(v) {
  return Array.isArray(v) ? v : [];
}

export function readDeliveryMoatCatalog() {
  return deepFreeze({
    version: catalogState.version,
    candidates: [...catalogState.candidates],
    published: [...catalogState.published],
    updatedAt: catalogState.updatedAt,
  });
}

export function resetDeliveryMoatCatalogForTests() {
  catalogState = emptyCatalog();
}

function writeCatalog(next) {
  catalogState = {
    version: DELIVERY_MOAT_VERSION,
    candidates: asArray(next.candidates),
    published: asArray(next.published),
    updatedAt: next.updatedAt ?? new Date().toISOString(),
  };
  return readDeliveryMoatCatalog();
}

/**
 * Detect residual PII / confidential fields. Fail closed.
 */
export function assertScrubbed(value, { path = "root" } = {}) {
  const violations = [];

  function walk(node, p) {
    if (node == null) return;
    if (typeof node === "string") {
      if (EMAIL_RE.test(node)) violations.push({ path: p, code: "email_in_string" });
      if (PHONE_RE.test(node)) violations.push({ path: p, code: "phone_in_string" });
      return;
    }
    if (typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((entry, i) => walk(entry, `${p}[${i}]`));
      return;
    }
    for (const [key, child] of Object.entries(node)) {
      const keyNorm = String(key).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (ALLOWED_STRUCTURE_KEYS.has(key)) {
        walk(child, `${p}.${key}`);
        continue;
      }
      if (FORBIDDEN_KEY_FRAGMENTS.some((frag) => keyNorm.includes(frag))) {
        violations.push({ path: `${p}.${key}`, code: "forbidden_key", key });
        continue;
      }
      walk(child, `${p}.${key}`);
    }
  }

  walk(value, path);
  if (violations.length) {
    return deepFreeze({
      ok: false,
      code: "scrub_failed",
      message: "Promotion refused — residual customer content or forbidden keys detected.",
      violations: violations.slice(0, 20),
    });
  }
  return deepFreeze({ ok: true });
}

/**
 * Drop confidential fields from a rule / intervention-derived object.
 */
export function scrubStructure(input = {}) {
  const out = {};
  if (Array.isArray(input.rootCauseCodes)) {
    out.rootCauseCodes = input.rootCauseCodes.map(String).slice(0, 20);
  }
  if (Array.isArray(input.evidenceKinds)) {
    out.evidenceKinds = input.evidenceKinds.map(String).slice(0, 20);
  }
  if (Array.isArray(input.eventTypes)) {
    out.eventTypes = input.eventTypes.map(String).slice(0, 20);
  }
  if (input.rftPatchShape && typeof input.rftPatchShape === "object") {
    const patch = input.rftPatchShape;
    out.rftPatchShape = {};
    if (patch.sla && typeof patch.sla === "object") {
      out.rftPatchShape.sla = {};
      if (patch.sla.acknowledgeWithinMinutes != null) {
        out.rftPatchShape.sla.acknowledgeWithinMinutes = Number(patch.sla.acknowledgeWithinMinutes);
      }
      if (patch.sla.proposalReviewCadenceDays != null) {
        out.rftPatchShape.sla.proposalReviewCadenceDays = Number(patch.sla.proposalReviewCadenceDays);
      }
    }
    if (patch.approvalRules && typeof patch.approvalRules === "object") {
      out.rftPatchShape.approvalRules = {};
      for (const k of [
        "customerFacingRequiresApproval",
        "newProspectOutboundRequiresApproval",
        "existingCustomerSchedulingMayAuto",
        "pricingOutsidePolicyRequiresApproval",
      ]) {
        if (patch.approvalRules[k] != null) {
          out.rftPatchShape.approvalRules[k] = Boolean(patch.approvalRules[k]);
        }
      }
    }
  }
  if (input.companyRuleShape && typeof input.companyRuleShape === "object") {
    out.companyRuleShape = {
      titleTemplate: scrubTemplateText(input.companyRuleShape.titleTemplate),
      bodyTemplate: scrubTemplateText(input.companyRuleShape.bodyTemplate),
      reasonCode: input.companyRuleShape.reasonCode
        ? String(input.companyRuleShape.reasonCode)
        : null,
    };
  }
  if (input.autonomyGate && typeof input.autonomyGate === "object") {
    out.autonomyGate = {
      classId: input.autonomyGate.classId ? String(input.autonomyGate.classId) : null,
      risk: input.autonomyGate.risk ? String(input.autonomyGate.risk) : null,
      minSample: Number(input.autonomyGate.minSample) || null,
      minApprovalRate: Number(input.autonomyGate.minApprovalRate) || null,
      maxEditRate: Number(input.autonomyGate.maxEditRate) || null,
    };
  }
  return deepFreeze(out);
}

function scrubTemplateText(value) {
  if (value == null) return null;
  let text = String(value);
  text = text.replace(EMAIL_RE, "[email]");
  text = text.replace(PHONE_RE, "[phone]");
  // Strip likely personal names in "Acme Corp" style is hard — drop quoted free text blobs
  if (text.length > 280) text = `${text.slice(0, 280)}…`;
  return text;
}

function patternKindForRootCause(code) {
  switch (String(code)) {
    case "customer_delay":
      return "proposal_stall_follow_up";
    case "missing_integration":
    case "provider_failure":
      return "integration_recovery";
    case "ai_quality_failure":
      return "approval_boundary";
    case "missing_business_rule":
    case "incorrect_classification":
      return "assignment_rule";
    case "insufficient_knowledge":
      return "handoff_requirement";
    default:
      return "assignment_rule";
  }
}

function patternKindForRule(rule) {
  const patch = rule?.suggestedPatch;
  if (patch?.kind === "rft_patch" && patch.patch?.rft?.sla) return "ack_sla_default";
  if (patch?.kind === "rft_patch" && patch.patch?.rft?.approvalRules) return "approval_boundary";
  if (rule?.reasonCode) return patternKindForRootCause(rule.reasonCode);
  return "assignment_rule";
}

/**
 * Extract scrubbed candidates from cross-tenant aggregates (ids hashed/counted only).
 */
export function extractMoatCandidates({
  interventionsByBusiness = [],
  rulesByBusiness = [],
  nowISO = null,
} = {}) {
  const at = nowISO ?? new Date().toISOString();
  const byKind = new Map();

  // Root-cause aggregates
  const tenantSetByCause = new Map();
  const causeCounts = new Map();
  let earliest = null;
  let latest = null;
  for (const row of interventionsByBusiness) {
    const tenantKey = hashTenant(row.businessId);
    for (const closed of asArray(row.closed)) {
      const code = String(closed.rootCause ?? "");
      if (!code) continue;
      causeCounts.set(code, (causeCounts.get(code) ?? 0) + 1);
      if (!tenantSetByCause.has(code)) tenantSetByCause.set(code, new Set());
      tenantSetByCause.get(code).add(tenantKey);
      const ts = closed.closedAt ?? null;
      if (ts && (!earliest || ts < earliest)) earliest = ts;
      if (ts && (!latest || ts > latest)) latest = ts;
    }
  }

  for (const [code, count] of causeCounts.entries()) {
    if (count < 1) continue;
    const kind = patternKindForRootCause(code);
    const key = `${kind}:${code}`;
    const structure = scrubStructure({
      rootCauseCodes: [code],
      evidenceKinds: ["operator_case_id"],
      eventTypes: ["EXCEPTION_RESOLVED"],
      companyRuleShape: {
        titleTemplate: `Operating pattern for ${code.replace(/_/g, " ")}`,
        bodyTemplate: `When ${code.replace(/_/g, " ")} repeats, require an explicit Company Rule before auto-progressing similar opportunities.`,
        reasonCode: code,
      },
    });
    byKind.set(key, {
      candidateId: `moat_${kind}_${code}`,
      status: "candidate",
      patternKind: kind,
      title: structure.companyRuleShape.titleTemplate,
      structure,
      provenance: {
        anonymizedTenantCount: tenantSetByCause.get(code)?.size ?? 0,
        dateRange: { from: earliest, to: latest },
        rootCauseDistribution: { [code]: count },
        sourceTypes: ["operator_intervention"],
        extractedAt: at,
        sampleCount: count,
      },
      publishedBlueprintId: null,
      rawRefused: false,
    });
  }

  // Approved Company Rules (structural patches only)
  const ruleTenantSets = new Map();
  for (const row of rulesByBusiness) {
    const tenantKey = hashTenant(row.businessId);
    for (const rule of asArray(row.rules)) {
      if (String(rule.status) !== "active") continue;
      const kind = patternKindForRule(rule);
      const reason = String(rule.reasonCode ?? "approved_rule");
      const key = `${kind}:rule:${reason}`;
      if (!ruleTenantSets.has(key)) ruleTenantSets.set(key, new Set());
      ruleTenantSets.get(key).add(tenantKey);

      const patch = rule.suggestedPatch;
      const structure = scrubStructure({
        rootCauseCodes: reason ? [reason] : [],
        rftPatchShape: patch?.kind === "rft_patch" ? (patch.patch?.rft ?? {}) : null,
        companyRuleShape: patch?.kind === "company_rule_text"
          ? {
            titleTemplate: scrubTemplateText(patch.title ?? rule.title),
            bodyTemplate: scrubTemplateText(patch.body ?? rule.body),
            reasonCode: reason,
          }
          : {
            titleTemplate: scrubTemplateText(rule.title),
            bodyTemplate: scrubTemplateText(rule.body),
            reasonCode: reason,
          },
      });

      const prior = byKind.get(key);
      const tenants = ruleTenantSets.get(key);
      byKind.set(key, {
        candidateId: `moat_${kind}_rule_${reason}`,
        status: "candidate",
        patternKind: kind,
        title: structure.companyRuleShape?.titleTemplate ?? `Rule pattern: ${reason}`,
        structure,
        provenance: {
          anonymizedTenantCount: tenants?.size ?? 1,
          dateRange: {
            from: prior?.provenance?.dateRange?.from ?? rule.approvedAt ?? at,
            to: rule.approvedAt ?? at,
          },
          rootCauseDistribution: {
            ...(prior?.provenance?.rootCauseDistribution ?? {}),
            [reason]: (prior?.provenance?.rootCauseDistribution?.[reason] ?? 0) + 1,
          },
          sourceTypes: [...new Set([
            ...(prior?.provenance?.sourceTypes ?? []),
            "company_rule",
          ])],
          extractedAt: at,
          sampleCount: (prior?.provenance?.sampleCount ?? 0) + 1,
        },
        publishedBlueprintId: null,
        rawRefused: false,
      });
    }
  }

  // Autonomy class gate shapes (catalog-level — no tenant PII)
  for (const cls of RFT_ACTION_CLASSES) {
    if (cls.risk === "low") continue;
    const kind = cls.id === "existing_customer_scheduling"
      ? "scheduling_autonomy_gate"
      : "approval_boundary";
    const key = `autonomy:${cls.id}`;
    const structure = scrubStructure({
      autonomyGate: {
        classId: cls.id,
        risk: cls.risk,
        minSample: 5,
        minApprovalRate: 0.9,
        maxEditRate: 0.1,
      },
      eventTypes: asArray(cls.eventKinds),
    });
    byKind.set(key, {
      candidateId: `moat_${kind}_${cls.id}`,
      status: "candidate",
      patternKind: kind,
      title: `Autonomy gate: ${cls.label}`,
      structure,
      provenance: {
        anonymizedTenantCount: 0,
        dateRange: { from: at, to: at },
        rootCauseDistribution: {},
        sourceTypes: ["earned_autonomy"],
        extractedAt: at,
        sampleCount: 0,
        note: "Catalog-level gate shape — not tenant metrics.",
      },
      publishedBlueprintId: null,
      rawRefused: false,
    });
  }

  const candidates = [...byKind.values()].map((c) => deepFreeze(c));
  return deepFreeze({ candidates, extractedAt: at });
}

function hashTenant(businessId) {
  // Non-reversible-enough for provenance counts (not cryptographic — just no raw id in catalog)
  const s = String(businessId ?? "unknown");
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `t_${Math.abs(h).toString(36)}`;
}

/**
 * Merge extracted candidates into catalog (idempotent by candidateId).
 */
export function upsertCandidates(extractedCandidates = [], { nowISO = null } = {}) {
  const prior = readDeliveryMoatCatalog();
  const at = nowISO ?? new Date().toISOString();
  const byId = new Map(prior.candidates.map((c) => [c.candidateId, c]));
  for (const c of extractedCandidates) {
    const existing = byId.get(c.candidateId);
    if (existing?.status === "published") {
      byId.set(c.candidateId, {
        ...existing,
        provenance: c.provenance,
        structure: c.structure,
      });
      continue;
    }
    if (existing?.status === "rejected") continue;
    byId.set(c.candidateId, { ...c, status: existing?.status ?? "candidate" });
  }
  return writeCatalog({
    candidates: [...byId.values()],
    published: prior.published,
    updatedAt: at,
  });
}

/**
 * Attempt to promote raw customer content — must fail closed.
 */
export function refuseRawPromotion(rawPayload) {
  const gate = assertScrubbed(rawPayload);
  if (gate.ok) {
    // Even if scrubbed empty-looking, refuse unlabeled raw blobs
    return deepFreeze({
      ok: false,
      code: "raw_promotion_forbidden",
      message: "Raw customer payloads cannot be promoted. Extract a scrubbed candidate first.",
    });
  }
  return deepFreeze({
    ok: false,
    code: gate.code,
    message: gate.message,
    violations: gate.violations,
  });
}

/**
 * Promote a scrubbed candidate into a BlueprintRegistry entry.
 */
export function promoteCandidateToBlueprint({
  candidateId,
  actorId = "platform_admin",
  blueprintRegistry = null,
  nowISO = null,
} = {}) {
  const prior = readDeliveryMoatCatalog();
  const at = nowISO ?? new Date().toISOString();
  const candidate = prior.candidates.find((c) => String(c.candidateId) === String(candidateId));
  if (!candidate) {
    return { ok: false, code: "candidate_not_found", message: "Candidate not found.", catalog: prior };
  }
  if (candidate.status === "published") {
    return {
      ok: true,
      alreadyPublished: true,
      blueprintId: candidate.publishedBlueprintId,
      catalog: prior,
    };
  }

  const scrub = assertScrubbed(candidate.structure);
  if (!scrub.ok) {
    return { ok: false, ...scrub, catalog: prior };
  }

  // Refuse if structure still embeds raw-looking strings from bad extract
  const blob = JSON.stringify(candidate.structure);
  if (EMAIL_RE.test(blob) || PHONE_RE.test(blob)) {
    return {
      ok: false,
      code: "scrub_failed",
      message: "Candidate structure still contains PII-like strings.",
      catalog: prior,
    };
  }

  const blueprintId = `bp_moat_${candidate.patternKind}_${String(candidate.candidateId).replace(/^moat_/, "").slice(0, 40)}`;
  const blueprint = createBlueprintDefinition({
    blueprintId,
    name: `Moat · ${candidate.title}`.slice(0, 120),
    industry: "universal",
    version: 1,
    maturity: "experimental",
    source: DELIVERY_MOAT_SOURCE,
    goldStatus: false,
    dependencies: ["bp_platform_universal_core", "bp_rft_b2b_services"],
    supportedCapabilities: ["approved_knowledge", "work_queue"],
    requiredCapabilities: ["work_queue"],
    readinessChecks: [
      {
        checkId: "delivery_moat_pattern_optional",
        description: "Optional library pattern from delivery — not auto-applied to live contracts.",
      },
    ],
    acceptanceTests: ["delivery_moat_provenance_present"],
    metadata: {
      source: DELIVERY_MOAT_SOURCE,
      patternKind: candidate.patternKind,
      structure: candidate.structure,
      provenance: {
        ...candidate.provenance,
        promotedAt: at,
        promotedBy: String(actorId),
        // Explicit: no business ids
        businessIds: undefined,
      },
    },
  });

  if (blueprintRegistry?.register) {
    blueprintRegistry.register(blueprint, { replace: true });
  }

  const publishedEntry = deepFreeze({
    blueprintId,
    candidateId: candidate.candidateId,
    patternKind: candidate.patternKind,
    title: candidate.title,
    promotedAt: at,
    promotedBy: String(actorId),
    provenance: candidate.provenance,
  });

  const candidates = prior.candidates.map((c) => (
    String(c.candidateId) === String(candidateId)
      ? { ...c, status: "published", publishedBlueprintId: blueprintId, publishedAt: at }
      : c
  ));
  const published = [
    publishedEntry,
    ...prior.published.filter((p) => p.blueprintId !== blueprintId),
  ].slice(0, 200);

  const catalog = writeCatalog({ candidates, published, updatedAt: at });
  return deepFreeze({
    ok: true,
    blueprint,
    published: publishedEntry,
    catalog,
  });
}

export function rejectCandidate(candidateId, { actorId = "platform_admin", nowISO = null, note = null } = {}) {
  const prior = readDeliveryMoatCatalog();
  const at = nowISO ?? new Date().toISOString();
  const candidates = prior.candidates.map((c) => (
    String(c.candidateId) === String(candidateId)
      ? {
        ...c,
        status: "rejected",
        rejectedAt: at,
        rejectedBy: String(actorId),
        // note scrubbed — store code only
        rejectReason: note ? scrubTemplateText(String(note).slice(0, 200)) : null,
      }
      : c
  ));
  return writeCatalog({
    candidates,
    published: prior.published,
    updatedAt: at,
  });
}

export { EMAIL_RE, PHONE_RE };
