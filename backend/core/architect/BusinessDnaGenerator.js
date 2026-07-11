import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  createBusinessDna,
  validateBusinessDna,
  businessDnaFromSummary,
} from "../platform/contracts/BusinessDna.js";
import { createArchitectStageResult } from "./ArchitectStageResult.js";

/**
 * Generates canonical Business DNA from discovery + research + documents.
 * Human understanding only — never runtime / never Business OS.
 */
export class BusinessDnaGenerator {
  generate({
    businessSummary = {},
    evidence = [],
    websiteFindings = null,
    documents = [],
    businessId = null,
    sourceSessionId = null,
    nowISO = new Date().toISOString(),
  } = {}) {
    const base = businessDnaFromSummary(businessSummary, {
      dnaId: `dna_${sourceSessionId ?? businessId ?? Date.now()}`,
      businessId,
      sourceSessionId,
    });

    const departments = inferDepartments(businessSummary);
    const workflows = inferWorkflows(businessSummary, documents);
    const recurringWork = inferRecurring(businessSummary);
    const kpis = inferKpis(businessSummary);
    const policies = inferPolicies(businessSummary, websiteFindings);
    const integrations = mergeNamed(
      base.integrations,
      asNamed(businessSummary.currentSoftware),
      asNamed(websiteFindings?.contactMethods?.map((entry) => `channel:${entry}`)),
    );

    const dna = createBusinessDna({
      ...base,
      company: {
        ...base.company,
        name: websiteFindings?.companyIdentity ?? base.company.name,
        locations: unique([
          ...(base.company.locations ?? []),
          ...(websiteFindings?.locations ?? []),
          ...(businessSummary.locations ?? []),
        ]),
        howTheyMakeMoney: inferRevenueModel(businessSummary),
        whatTheyDo: businessSummary.description
          ?? websiteFindings?.services?.slice(0, 3).join(", ")
          ?? null,
      },
      services: mergeNamed(base.services, asNamed(websiteFindings?.services)),
      customers: mergeNamed(base.customers, asNamed(websiteFindings?.customerTypes)),
      departments,
      team: mergeNamed(base.team, asNamed(websiteFindings?.teamMembers)),
      workflows,
      approvals: mergeNamed(base.approvals, asNamed(businessSummary.approvalNeeds)),
      recurringWork,
      terminology: {
        ...base.terminology,
        ...(websiteFindings?.terminology
          ? Object.fromEntries(
            (Array.isArray(websiteFindings.terminology)
              ? websiteFindings.terminology
              : Object.entries(websiteFindings.terminology)
            ).map((entry) => (
              Array.isArray(entry) ? entry : [String(entry), String(entry)]
            )),
          )
          : {}),
      },
      integrations,
      kpis,
      policies,
      goals: mergeNamed(base.goals, asNamed(businessSummary.desiredOutcomes)),
      constraints: mergeNamed(base.constraints, asNamed(businessSummary.painPoints)),
      confidence: {
        overall: scoreOverallConfidence({ businessSummary, websiteFindings, documents, evidence }),
        website: websiteFindings ? "medium" : "unknown",
        documents: documents.length ? "medium" : "unknown",
      },
      unresolvedQuestions: [
        ...(businessSummary.unresolvedQuestions ?? []),
        ...(!businessSummary.industry ? [{ questionId: "q_industry", prompt: "What industry are you in?" }] : []),
        ...(!businessSummary.roles?.length ? [{ questionId: "q_roles", prompt: "What roles do people have?" }] : []),
      ],
      createdAt: nowISO,
      updatedAt: nowISO,
    });

    const validation = validateBusinessDna(dna);
    return createArchitectStageResult({
      stageId: "business_dna",
      ok: validation.ok,
      inputs: {
        hasWebsiteFindings: Boolean(websiteFindings),
        documentCount: documents.length,
        evidenceCount: evidence.length,
      },
      outputs: { dna, validation },
      confidence: dna.confidence.overall,
      evidence: evidence.slice(0, 12).map(summarizeEvidence),
      unresolvedQuestions: dna.unresolvedQuestions,
      recommendations: [{
        kind: "next",
        label: "Analyze Business DNA before Blueprint matching",
        why: "Understanding must precede assembly.",
      }],
      explanation: "Business DNA is the human-readable understanding of the company. It is not the Business OS.",
    });
  }
}

function inferRevenueModel(summary) {
  const industry = String(summary.industry ?? "").toLowerCase();
  if (industry === "property_management") return "Property management fees and leasing services";
  if (industry === "dental") return "Patient care services and treatment plans";
  if (industry === "sports" || industry === "hockey") return "Club memberships, travel programs, and team fees";
  if (summary.services?.length) return `Services: ${asList(summary.services).slice(0, 4).join(", ")}`;
  return null;
}

function inferDepartments(summary) {
  const roles = asList(summary.roles);
  const deps = [];
  if (roles.some((role) => /owner|manager|admin/i.test(role))) deps.push({ label: "Leadership" });
  if (roles.some((role) => /sales|leasing|intake/i.test(role))) deps.push({ label: "Sales / Intake" });
  if (roles.some((role) => /ops|operations|coordinator|coach/i.test(role))) deps.push({ label: "Operations" });
  if (roles.some((role) => /hygien|clinician|technician/i.test(role))) deps.push({ label: "Clinical" });
  if (!deps.length && roles.length) deps.push({ label: "General operations" });
  return deps;
}

function inferWorkflows(summary, documents = []) {
  const workflows = [];
  const blob = JSON.stringify({ summary, documents }).toLowerCase();
  if (/follow-?up|prospect|lead/.test(blob)) workflows.push({ label: "Follow-up", kind: "relationship" });
  if (/schedul|appointment|showing/.test(blob)) workflows.push({ label: "Scheduling", kind: "operations" });
  if (/intake|onboard|new patient|new resident/.test(blob)) workflows.push({ label: "Intake", kind: "intake" });
  if (/maintenance|work order/.test(blob)) workflows.push({ label: "Maintenance request", kind: "operations" });
  if (/campaign|newsletter/.test(blob)) workflows.push({ label: "Campaign preparation", kind: "marketing" });
  if (!workflows.length) workflows.push({ label: "General work routing", kind: "operations" });
  return workflows;
}

function inferRecurring(summary) {
  const items = [];
  const blob = JSON.stringify(summary).toLowerCase();
  if (/recall|newsletter|weekly|monthly|recurring/.test(blob)) {
    items.push({ label: "Recurring outreach", cadence: "weekly_or_monthly" });
  }
  if (/report|kpi|owner report/.test(blob)) items.push({ label: "Recurring reporting", cadence: "monthly" });
  return items;
}

function inferKpis(summary) {
  const industry = String(summary.industry ?? "").toLowerCase();
  if (industry === "property_management") {
    return [
      { label: "Open maintenance work" },
      { label: "Prospect follow-ups due" },
      { label: "Occupancy signals (when data exists)" },
    ];
  }
  if (industry === "dental") {
    return [
      { label: "Patients needing recall" },
      { label: "Open treatment follow-ups" },
      { label: "Approval queue depth" },
    ];
  }
  if (industry === "sports" || industry === "hockey") {
    return [
      { label: "Travel readiness" },
      { label: "Parent communications pending approval" },
      { label: "Roster completeness" },
    ];
  }
  return [
    { label: "Open work" },
    { label: "Approvals waiting" },
    { label: "Setup completeness" },
  ];
}

function inferPolicies(summary, websiteFindings) {
  const policies = [{ label: "Human approval before customer-facing sends" }];
  if (websiteFindings?.policies?.length) {
    for (const policy of websiteFindings.policies.slice(0, 5)) {
      policies.push({ label: String(policy) });
    }
  }
  if (/hipaa|phi|patient/.test(JSON.stringify(summary).toLowerCase())) {
    policies.push({ label: "Protect patient-sensitive information" });
  }
  return policies;
}

function scoreOverallConfidence({ businessSummary, websiteFindings, documents, evidence }) {
  let score = 0.35;
  if (businessSummary.businessName) score += 0.1;
  if (businessSummary.industry) score += 0.15;
  if (businessSummary.services?.length) score += 0.1;
  if (businessSummary.roles?.length) score += 0.1;
  if (websiteFindings) score += 0.1;
  if (documents?.length) score += 0.05;
  if (evidence?.length >= 2) score += 0.05;
  if (score >= 0.85) return "high";
  if (score >= 0.55) return "medium";
  return "low";
}

function asList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((entry) => (typeof entry === "string" ? entry : entry.label ?? String(entry)));
  return [String(value)];
}

function asNamed(value) {
  return asList(value).map((label) => ({ label }));
}

function mergeNamed(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const entry of list ?? []) {
      const label = String(entry.label ?? entry).toLowerCase();
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push(typeof entry === "object" ? entry : { label: String(entry) });
    }
  }
  return out;
}

function unique(items) {
  return [...new Set(items.map(String).filter(Boolean))];
}

function summarizeEvidence(entry) {
  return {
    evidenceId: entry.evidenceId ?? entry.id ?? null,
    kind: entry.kind ?? entry.source ?? "evidence",
    label: entry.label ?? null,
  };
}

export { deepFreeze };
