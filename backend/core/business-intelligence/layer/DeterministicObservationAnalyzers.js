import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { createIntelligenceFinding } from "../../platform/contracts/BusinessIntelligenceContracts.js";

/**
 * Deterministic observation analyzers — plain-English findings from existing signals.
 * No opaque scores. No mutation.
 */
export function analyzeDeterministicObservations({
  companyRuntime = null,
  companyBrief = null,
  companyHealth = null,
  companyInsights = null,
  companyOpportunities = null,
  installation = null,
  analytics = null,
  workRuntime = null,
  requestRuntime = null,
  businessSummary = {},
} = {}) {
  const findings = [];

  const workItems = safeArray(
    workRuntime?.getWorkItems?.()
    ?? workRuntime?.listWork?.()
    ?? companyRuntime?.getWorkQueue?.()?.items,
  );
  const openWork = workItems.filter((item) => {
    const status = String(item.status ?? item.state ?? "").toLowerCase();
    return status && !/done|complete|closed|cancelled/.test(status);
  });
  const assignmentMissing = openWork.filter((item) => !item.assigneeId && !item.ownerId && !item.assignedTo);

  if (assignmentMissing.length >= 3) {
    const hours = Math.min(20, Math.round(assignmentMissing.length * 1.75));
    findings.push(finding({
      findingId: "obs_manual_vendor_assignment",
      claim: `Your maintenance coordinator spends about ${hours} hours/week manually assigning work.`,
      confidence: assignmentMissing.length >= 6 ? "high" : "medium",
      kind: "capacity_automation",
      category: "capacity",
      businessImpact: "Manual assignment delays response time and burns coordinator capacity.",
      affectedDepartments: ["Operations", "Maintenance"],
      affectedEmployees: ["Maintenance Coordinator"],
      estimatedSavings: `${hours} hours/week of coordinator time`,
      risk: "medium",
      evidence: [
        `${assignmentMissing.length} open work items lack an assignee`,
        `${openWork.length} total open work items in the queue`,
      ],
      priority: "immediate",
      requiredApprovals: ["owner", "operations_manager"],
      improvePrompt: "Automate vendor and work assignment for the maintenance coordinator while keeping human approval on exceptions.",
    }));
  }

  const parties = safeArray(
    companyRuntime?.getBusinessGraph?.()?.parties
    ?? companyRuntime?.ctx?.businessGraphRuntime?.getParties?.(),
  );
  const duplicateSignals = detectDuplicateCustomerSignals(parties, businessSummary);
  if (duplicateSignals.count >= 1) {
    findings.push(finding({
      findingId: "obs_duplicate_customer_intake",
      claim: "Marketing and Sales are collecting duplicate customer information.",
      confidence: duplicateSignals.count >= 2 ? "high" : "medium",
      kind: "duplicate_intake",
      category: "opportunity",
      businessImpact: "Duplicate intake creates conflicting records and slows follow-up.",
      affectedDepartments: ["Marketing", "Sales", "Customer Success"],
      affectedEmployees: ["Front Desk", "Sales Coordinator"],
      estimatedSavings: "Fewer duplicate records and faster first response",
      risk: "medium",
      evidence: duplicateSignals.evidence,
      priority: "soon",
      requiredApprovals: ["owner"],
      prefersConfiguration: true,
      improvePrompt: "Unify customer intake so Marketing and Sales share one customer record path.",
    }));
  }

  const terminology = installation?.configuration?.terminology
    ?? installation?.terminology
    ?? businessSummary.terminology
    ?? null;
  const termConflict = detectTerminologyConflict(terminology, businessSummary);
  if (termConflict) {
    findings.push(finding({
      findingId: "obs_terminology_conflict",
      claim: "Two departments are using different terminology for the same object.",
      confidence: "high",
      kind: "terminology",
      category: "risk",
      businessImpact: "Inconsistent labels confuse teams and break reporting alignment.",
      affectedDepartments: termConflict.departments,
      affectedEmployees: ["Owner", "Managers"],
      estimatedSavings: "Clearer handoffs and fewer misrouted requests",
      risk: "low",
      evidence: termConflict.evidence,
      priority: "soon",
      requiredApprovals: ["owner"],
      prefersConfiguration: true,
      improvePrompt: `Standardize terminology: use one label for ${termConflict.objectLabel}.`,
    }));
  }

  const workforce = safeArray(
    installation?.configuration?.digitalWorkforce
    ?? installation?.specification?.digitalWorkforce
    ?? businessSummary.roles,
  );
  const customerSuccess = workforce.filter((entry) =>
    /customer success|success|retention|support/i.test(String(entry.label ?? entry.name ?? entry)),
  );
  if (customerSuccess.length === 1 && (businessSummary.customerTypes?.length ?? 0) >= 2) {
    findings.push(finding({
      findingId: "obs_split_customer_success",
      claim: "You should split Customer Success into two AI employees.",
      confidence: "medium",
      kind: "split_employee",
      category: "ai_suggestion",
      businessImpact: "One employee covering two customer types dilutes focus and misses follow-ups.",
      affectedDepartments: ["Customer Success"],
      affectedEmployees: [String(customerSuccess[0].label ?? customerSuccess[0].name ?? "Customer Success")],
      estimatedSavings: "Higher retention coverage without adding headcount",
      risk: "medium",
      evidence: [
        "Single Customer Success employee covers multiple customer types",
        `Customer types observed: ${(businessSummary.customerTypes ?? []).slice(0, 4).join(", ") || "multiple"}`,
      ],
      priority: "later",
      requiredApprovals: ["owner"],
      improvePrompt: "Split Customer Success into two AI employees aligned to distinct customer types.",
    }));
  }

  const requests = safeArray(
    requestRuntime?.getRequests?.()
    ?? requestRuntime?.listRequests?.()
    ?? companyRuntime?.getRequests?.(),
  );
  const intakeOpen = requests.filter((item) => {
    const status = String(item.status ?? "").toLowerCase();
    return /open|new|intake|pending|queued/.test(status) || !status;
  });
  if (intakeOpen.length >= 5) {
    findings.push(finding({
      findingId: "obs_intake_bottleneck",
      claim: "Your intake workflow is becoming a bottleneck.",
      confidence: intakeOpen.length >= 10 ? "high" : "medium",
      kind: "intake_bottleneck",
      category: "risk",
      businessImpact: "Intake backlog delays revenue and customer trust.",
      affectedDepartments: ["Front Desk", "Sales", "Operations"],
      affectedEmployees: ["Front Desk Coordinator"],
      estimatedSavings: "Faster time-to-first-response",
      risk: "high",
      evidence: [
        `${intakeOpen.length} intake items waiting`,
        companyHealth?.risks?.length
          ? `${companyHealth.risks.length} active health risks recorded`
          : "Intake volume exceeds steady handling pace",
      ],
      priority: "immediate",
      requiredApprovals: ["owner", "operations_manager"],
      improvePrompt: "Relieve the intake workflow bottleneck with clearer routing and AI employee triage.",
    }));
  }

  const missingMetrics = safeArray(analytics?.missing ?? analytics?.missingData);
  const unpaidSignal = missingMetrics.some((entry) =>
    /invoice|unpaid|ar|receivable|payment/i.test(String(entry.id ?? entry.label ?? entry)),
  ) || /propert|leasing|dental|service/i.test(String(businessSummary.industry ?? ""));
  if (unpaidSignal && (missingMetrics.length > 0 || openWork.length > 0)) {
    findings.push(finding({
      findingId: "obs_front_desk_unpaid",
      claim: "The Front Desk dashboard should surface unpaid invoices.",
      confidence: missingMetrics.length ? "medium" : "low",
      kind: "dashboard_gap",
      category: "opportunity",
      businessImpact: "Collections visibility at the front desk recovers revenue earlier.",
      affectedDepartments: ["Finance", "Front Desk"],
      affectedEmployees: ["Front Desk Coordinator", "Owner"],
      estimatedSavings: "Earlier collection of outstanding balances",
      risk: "low",
      evidence: missingMetrics.length
        ? missingMetrics.slice(0, 3).map((entry) => String(entry.label ?? entry.id ?? entry))
        : ["Operating business with billing-sensitive industry signals", "No unpaid invoice card on Front Desk home"],
      priority: "soon",
      requiredApprovals: ["owner"],
      improvePrompt: "Add unpaid invoices to the Front Desk dashboard home screen.",
    }));
  }

  // Surface top health risks as explicit findings (already computed by CompanyHealthEngine).
  for (const risk of safeArray(companyHealth?.risks).slice(0, 3)) {
    findings.push(finding({
      findingId: `obs_health_${risk.id ?? risk.title ?? findings.length}`,
      claim: String(risk.title ?? risk.summary ?? risk.label ?? "Business health risk detected"),
      confidence: risk.priority === "HIGH" ? "high" : "medium",
      kind: "health_risk",
      category: "risk",
      businessImpact: String(risk.summary ?? risk.reason ?? "Health risk needs owner attention."),
      affectedDepartments: ["Leadership"],
      affectedEmployees: ["Owner"],
      estimatedSavings: null,
      risk: String(risk.priority ?? "medium").toLowerCase() === "high" ? "high" : "medium",
      evidence: [
        String(risk.reason ?? risk.summary ?? risk.title ?? "Recorded by Company Health"),
        companyHealth?.overallStatus ? `Overall health: ${companyHealth.overallStatus}` : "Company health engine finding",
      ],
      priority: String(risk.priority ?? "").toUpperCase() === "HIGH" ? "immediate" : "soon",
      requiredApprovals: ["owner"],
      prefersConfiguration: /knowledge|profile|terminology/i.test(String(risk.id ?? risk.title ?? "")),
      improvePrompt: String(risk.title ?? "Address the top business health risk"),
      source: "company_health",
    }));
  }

  // Opportunities already scored by CompanyOpportunityEngine — lift as findings.
  for (const opportunity of safeArray(companyOpportunities?.opportunities).slice(0, 4)) {
    findings.push(finding({
      findingId: `obs_opp_${opportunity.id}`,
      claim: String(opportunity.title),
      confidence: typeof opportunity.confidence === "number"
        ? opportunity.confidence >= 0.8 ? "high" : opportunity.confidence >= 0.5 ? "medium" : "low"
        : "medium",
      kind: "opportunity",
      category: "opportunity",
      businessImpact: String(opportunity.summary ?? opportunity.reason),
      affectedDepartments: inferDepartments(opportunity.category),
      affectedEmployees: ["Owner"],
      estimatedSavings: opportunity.estimatedValue ?? null,
      risk: opportunity.impact === "Very High" || opportunity.impact === "High" ? "medium" : "low",
      evidence: [
        String(opportunity.reason),
        `Priority ${opportunity.priority}, impact ${opportunity.impact}`,
      ],
      priority: opportunity.priority === "Now" || opportunity.priority === "HIGH" ? "immediate" : "soon",
      requiredApprovals: ["owner"],
      improvePrompt: String(opportunity.recommendedAction?.label ?? opportunity.title),
      source: "company_opportunity",
    }));
  }

  // Insights: what changed
  for (const insight of safeArray(companyInsights?.insights).slice(0, 4)) {
    findings.push(finding({
      findingId: `obs_insight_${insight.id ?? findings.length}`,
      claim: String(insight.title ?? insight.summary ?? "Business change detected"),
      confidence: insight.severity === "critical" || insight.severity === "high" ? "high" : "medium",
      kind: "change",
      category: "change",
      businessImpact: String(insight.summary ?? insight.reason ?? "A material change was detected."),
      affectedDepartments: inferDepartments(insight.category),
      affectedEmployees: ["Owner"],
      estimatedSavings: null,
      risk: insight.severity === "critical" ? "high" : "medium",
      evidence: [
        String(insight.reason ?? insight.summary ?? insight.title),
        companyBrief?.headline ? `Brief: ${companyBrief.headline}` : "Compared against prior health snapshot",
      ],
      priority: insight.severity === "critical" || insight.severity === "high" ? "immediate" : "soon",
      requiredApprovals: ["owner"],
      improvePrompt: String(insight.title ?? "Review recent business change"),
      source: "company_insight",
    }));
  }

  return deepFreeze({
    findings: Object.freeze(findings),
    observedAt: companyBrief?.generatedAt ?? companyHealth?.generatedAt ?? null,
    counts: deepFreeze({
      findings: findings.length,
      risks: findings.filter((entry) => entry.category === "risk").length,
      opportunities: findings.filter((entry) => entry.category === "opportunity").length,
      capacity: findings.filter((entry) => entry.category === "capacity").length,
    }),
  });
}

function finding(fields) {
  const base = createIntelligenceFinding({
    findingId: fields.findingId,
    claim: fields.claim,
    confidence: fields.confidence,
    evidenceIds: (fields.evidence ?? []).map((_, index) => `${fields.findingId}_ev_${index}`),
  });
  return deepFreeze({
    ...base,
    kind: fields.kind,
    category: fields.category,
    businessImpact: fields.businessImpact,
    affectedDepartments: Object.freeze([...(fields.affectedDepartments ?? [])]),
    affectedEmployees: Object.freeze([...(fields.affectedEmployees ?? [])]),
    estimatedSavings: fields.estimatedSavings ?? null,
    risk: fields.risk ?? "medium",
    evidenceLabels: Object.freeze([...(fields.evidence ?? [])].map(String)),
    priority: fields.priority ?? "soon",
    requiredApprovals: Object.freeze([...(fields.requiredApprovals ?? ["owner"])]),
    prefersConfiguration: Boolean(fields.prefersConfiguration),
    improvePrompt: fields.improvePrompt ?? fields.claim,
    source: fields.source ?? "deterministic_observation",
  });
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function detectDuplicateCustomerSignals(parties, businessSummary) {
  const evidence = [];
  let count = 0;
  const emails = new Map();
  for (const party of parties) {
    const email = String(party.email ?? party.primaryEmail ?? "").toLowerCase();
    if (!email) continue;
    emails.set(email, (emails.get(email) ?? 0) + 1);
  }
  for (const [email, hits] of emails.entries()) {
    if (hits > 1) {
      count += 1;
      evidence.push(`Duplicate email across ${hits} party records (${email})`);
    }
  }
  if (/marketing|sales/i.test(JSON.stringify(businessSummary.roles ?? businessSummary.departments ?? []))) {
    count += 1;
    evidence.push("Both Marketing and Sales roles are present without a shared intake path");
  }
  return { count, evidence: evidence.length ? evidence : ["Multiple intake channels observed"] };
}

function detectTerminologyConflict(terminology, businessSummary) {
  if (!terminology || typeof terminology !== "object") {
    const services = businessSummary.services ?? [];
    if (services.length >= 2 && /patient|customer|client|resident|tenant/i.test(JSON.stringify(services))) {
      return {
        objectLabel: "customer",
        departments: ["Operations", "Front Desk"],
        evidence: ["Service language mixes customer-facing terms without a single canonical label"],
      };
    }
    return null;
  }
  const customerLabel = terminology.customer ?? terminology.party ?? terminology.client;
  const alt = terminology.patient ?? terminology.resident ?? terminology.tenant;
  if (customerLabel && alt && String(customerLabel).toLowerCase() !== String(alt).toLowerCase()) {
    return {
      objectLabel: String(customerLabel),
      departments: ["Operations", "Customer Success"],
      evidence: [
        `Primary label: ${customerLabel}`,
        `Alternate label still in use: ${alt}`,
      ],
    };
  }
  return null;
}

function inferDepartments(category) {
  const c = String(category ?? "");
  if (c.includes("communication")) return ["Communications"];
  if (c.includes("knowledge")) return ["Knowledge", "Operations"];
  if (c.includes("workforce") || c.includes("digital")) return ["Workforce"];
  if (c.includes("work")) return ["Operations"];
  if (c.includes("connected")) return ["IT", "Operations"];
  return ["Leadership", "Operations"];
}
