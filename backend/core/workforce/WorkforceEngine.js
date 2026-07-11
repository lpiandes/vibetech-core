import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  getEmployeeArchetype,
  listEmployeeArchetypeIds,
  resolveOrgTemplate,
} from "./WorkforceArchetypeCatalog.js";
import { createWorkforceRecommendation } from "./WorkforceRecommendation.js";
import { mapWorkforceToBusinessOS } from "./mapWorkforceToBusinessOS.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function industryOf({ dna = null, businessSummary = {} } = {}) {
  return String(
    businessSummary.industry
    ?? dna?.company?.industry
    ?? "default",
  );
}

function dnaDepartments(dna) {
  return asArray(dna?.departments).map((entry, index) => ({
    departmentId: entry.departmentId ?? `dept_${index}`,
    label: entry.label ?? entry.name ?? `Department ${index + 1}`,
    purpose: entry.purpose ?? entry.description ?? "",
  }));
}

/**
 * Universal Workforce Engine — assemble complete organizations from reusable archetypes.
 */
export class WorkforceEngine {
  recommendOrganization({
    dna = null,
    businessSummary = {},
    evidence = [],
  } = {}) {
    const industry = industryOf({ dna, businessSummary });
    const template = resolveOrgTemplate(industry);
    const known = new Set(listEmployeeArchetypeIds());
    const baseEvidence = [
      `industry:${industry}`,
      ...asArray(evidence).map(String),
      ...(dna ? ["source:business_dna"] : ["source:business_summary"]),
    ];

    const departments = dnaDepartments(dna).length
      ? dnaDepartments(dna)
      : template.departments.map((entry) => ({ ...entry }));

    const teams = template.teams.map((entry) => ({ ...entry }));
    const humanRoles = template.humanRoles.map((entry) => ({ ...entry }));

    const recommendations = [];
    const gaps = [];
    const aiEmployees = [];

    // Department recommendations
    for (const department of departments) {
      recommendations.push(createWorkforceRecommendation({
        recommendationId: `rec_dept_${department.departmentId}`,
        kind: "org_department",
        label: department.label,
        reason: `Organize work under ${department.label} so responsibilities and escalations stay clear.`,
        confidence: dnaDepartments(dna).length ? 0.9 : 0.78,
        evidence: [...baseEvidence, `department:${department.departmentId}`],
        alternatives: departments
          .filter((entry) => entry.departmentId !== department.departmentId)
          .slice(0, 2)
          .map((entry) => entry.label),
        payload: { department },
        selected: true,
      }));
    }

    // Human role recommendations
    for (const role of humanRoles) {
      recommendations.push(createWorkforceRecommendation({
        recommendationId: `rec_role_${role.roleId}`,
        kind: "org_role",
        label: role.label,
        reason: `Human position ${role.label} anchors approvals and accountability.`,
        confidence: 0.84,
        evidence: [...baseEvidence, `role:${role.roleId}`, `membership:${role.membershipRole}`],
        alternatives: humanRoles
          .filter((entry) => entry.roleId !== role.roleId)
          .slice(0, 2)
          .map((entry) => entry.label),
        payload: {
          role,
          responsibilities: defaultHumanResponsibilities(role),
          approvals: role.membershipRole === "OWNER" || role.membershipRole === "MANAGER"
            ? ["customer_messages", "refunds", "campaign_sends"]
            : [],
          kpis: defaultRoleKpis(role),
          knowledgeOwnership: role.membershipRole === "OWNER" ? ["policies", "handbook"] : [],
          escalation: role.reportsTo ? { escalateTo: role.reportsTo } : null,
        },
        selected: true,
      }));
    }

    // AI employee positions from archetypes
    for (const position of template.aiPositions) {
      if (!known.has(position.archetypeId)) {
        gaps.push({
          kind: "reusable_archetype_needed",
          label: `Missing archetype: ${position.archetypeId}`,
          requestedOutcome: position.title,
          recommendation: "Add a reusable workforce archetype — do not invent a one-off employee.",
        });
        recommendations.push(createWorkforceRecommendation({
          recommendationId: `rec_gap_${position.archetypeId}`,
          kind: "archetype_gap",
          label: `Propose archetype: ${position.title}`,
          reason: `No reusable archetype matches "${position.archetypeId}". Recommend registering a reusable archetype instead of a one-off employee.`,
          confidence: 0.55,
          evidence: [...baseEvidence, `missing_archetype:${position.archetypeId}`],
          alternatives: suggestAlternativeArchetypes(position.archetypeId),
          payload: { requested: position },
          selected: false,
          missingCapabilities: [position.archetypeId],
        }));
        continue;
      }

      const archetype = getEmployeeArchetype(position.archetypeId);
      const employee = {
        employeeId: `ai_${position.archetypeId}`,
        label: position.title,
        archetypeId: position.archetypeId,
        purpose: archetype.purpose,
        departmentId: position.departmentId,
        teamId: position.teamId,
        reportsTo: position.reportsTo,
        kind: "ai_employee",
        responsibilities: defaultAiResponsibilities(position.archetypeId),
        approvals: ["customer_facing_messages", "campaign_sends"],
        kpis: defaultAiKpis(position.archetypeId),
        knowledgeOwnership: defaultKnowledgeOwnership(position.archetypeId),
        escalation: {
          escalateTo: position.reportsTo ?? "manager",
          coverageFallback: position.reportsTo ?? "owner",
          absenceFallback: "manager",
        },
        delegation: {
          canCover: [position.archetypeId],
          coveredBy: ["coordinator", "operations_monitor"],
        },
      };
      aiEmployees.push(employee);

      recommendations.push(createWorkforceRecommendation({
        recommendationId: `rec_emp_${position.archetypeId}`,
        kind: "employee_archetype",
        label: position.title,
        reason: `Specialize reusable ${archetype.label} archetype for ${industry.replace(/_/g, " ")} — never invent a one-off agent.`,
        confidence: 0.88,
        evidence: [
          ...baseEvidence,
          `archetype:${position.archetypeId}`,
          `department:${position.departmentId}`,
          `team:${position.teamId}`,
        ],
        alternatives: suggestAlternativeArchetypes(position.archetypeId),
        payload: { employee, archetype },
        selected: true,
      }));
    }

    // Reporting / escalation / coverage recommendations
    recommendations.push(createWorkforceRecommendation({
      recommendationId: "rec_reporting_structure",
      kind: "reporting_structure",
      label: "Reporting structure",
      reason: "Keep AI employees under human managers with clear escalation and absence coverage.",
      confidence: 0.86,
      evidence: [...baseEvidence, "policy:human_in_the_loop"],
      alternatives: ["Flat AI pool under owner", "Department-local AI only"],
      payload: {
        reportingLines: [
          ...humanRoles.map((role) => ({
            from: role.roleId,
            to: role.reportsTo,
            kind: "human",
          })),
          ...aiEmployees.map((employee) => ({
            from: employee.employeeId,
            to: employee.reportsTo,
            kind: "ai_employee",
          })),
        ],
      },
      selected: true,
    }));

    recommendations.push(createWorkforceRecommendation({
      recommendationId: "rec_coverage_rules",
      kind: "coverage_rules",
      label: "Coverage & absence fallback",
      reason: "Vacation and absence must never leave approvals or customer work uncovered.",
      confidence: 0.8,
      evidence: [...baseEvidence, "policy:coverage_required"],
      alternatives: ["Owner-only coverage", "Peer AI coverage with manager escalation"],
      payload: {
        rules: [
          { when: "manager_absent", fallback: "owner", appliesTo: ["approvals", "escalations"] },
          { when: "ai_offline", fallback: "manager", appliesTo: ["queues", "follow_up"] },
          { when: "owner_absent", fallback: "manager", appliesTo: ["non_financial_approvals"] },
        ],
      },
      selected: true,
    }));

    recommendations.push(createWorkforceRecommendation({
      recommendationId: "rec_recurring_reviews",
      kind: "recurring_reviews",
      label: "Recurring workforce reviews",
      reason: "Weekly operating review keeps responsibilities, KPIs, and escalations honest.",
      confidence: 0.77,
      evidence: [...baseEvidence, "cadence:weekly"],
      alternatives: ["Daily standup only", "Monthly leadership review only"],
      payload: {
        reviews: [
          { reviewId: "weekly_ops", label: "Weekly operations review", cadence: "weekly", owners: ["manager", "owner"] },
          { reviewId: "monthly_kpi", label: "Monthly KPI review", cadence: "monthly", owners: ["owner", "analyst"] },
        ],
      },
      selected: true,
    }));

    const organization = deepFreeze({
      industry,
      departments,
      teams,
      humanRoles,
      humans: humanRoles.map((role) => ({
        positionId: role.roleId,
        label: role.label,
        kind: "human_position",
        membershipRole: role.membershipRole,
        departmentId: role.departmentId,
        reportsTo: role.reportsTo,
      })),
      aiEmployees,
      reportingLines: recommendations.find((entry) => entry.kind === "reporting_structure")?.payload?.reportingLines ?? [],
      coverageRules: recommendations.find((entry) => entry.kind === "coverage_rules")?.payload?.rules ?? [],
      recurringReviews: recommendations.find((entry) => entry.kind === "recurring_reviews")?.payload?.reviews ?? [],
      responsibilities: [
        ...humanRoles.flatMap((role) => defaultHumanResponsibilities(role).map((text) => ({
          ownerId: role.roleId,
          ownerKind: "human",
          text,
        }))),
        ...aiEmployees.flatMap((employee) => employee.responsibilities.map((text) => ({
          ownerId: employee.employeeId,
          ownerKind: "ai_employee",
          text,
        }))),
      ],
      approvals: aiEmployees.flatMap((employee) => employee.approvals.map((item) => ({
        ownerId: employee.employeeId,
        requires: item,
        escalateTo: employee.escalation?.escalateTo ?? "manager",
      }))),
      kpis: [
        ...humanRoles.flatMap((role) => defaultRoleKpis(role).map((kpi) => ({
          ownerId: role.roleId,
          ownerKind: "human",
          kpi,
        }))),
        ...aiEmployees.flatMap((employee) => employee.kpis.map((kpi) => ({
          ownerId: employee.employeeId,
          ownerKind: "ai_employee",
          kpi,
        }))),
      ],
      knowledgeOwnership: aiEmployees.flatMap((employee) => employee.knowledgeOwnership.map((category) => ({
        ownerId: employee.employeeId,
        category,
      }))),
    });

    const businessOsMapping = mapWorkforceToBusinessOS(organization);

    return deepFreeze({
      ok: true,
      recommendations,
      organization,
      businessOsMapping,
      gaps,
      // Backward-compatible employee-only surface used by legacy callers.
      employees: recommendations.filter((entry) => entry.kind === "employee_archetype"),
    });
  }

  /** Convenience alias matching the previous employee engine API. */
  recommend(input = {}) {
    return this.recommendOrganization(input);
  }
}

function defaultHumanResponsibilities(role) {
  if (role.membershipRole === "OWNER") {
    return ["Set priorities", "Approve sensitive actions", "Own business outcomes"];
  }
  if (role.membershipRole === "MANAGER") {
    return ["Supervise day-to-day work", "Handle escalations", "Cover absences"];
  }
  return ["Execute assigned work", "Escalate blockers", "Keep records current"];
}

function defaultRoleKpis(role) {
  if (role.membershipRole === "OWNER") return ["business_control", "customer_outcomes"];
  if (role.membershipRole === "MANAGER") return ["queue_health", "sla_adherence"];
  return ["task_completion", "response_time"];
}

function defaultAiResponsibilities(archetypeId) {
  switch (String(archetypeId)) {
    case "scheduler":
      return ["Propose schedules", "Flag conflicts", "Prepare confirmations for approval"];
    case "analyst":
    case "reporting_analyst":
      return ["Summarize trends", "Prepare KPI packs", "Never invent metrics"];
    case "compliance_reviewer":
    case "quality_reviewer":
    case "reviewer":
      return ["Review drafts", "Flag policy risks", "Request human approval"];
    case "communications_specialist":
      return ["Draft communications", "Route for approval", "Log delivery outcomes"];
    default:
      return ["Coordinate assigned queues", "Escalate blockers", "Stay within approved permissions"];
  }
}

function defaultAiKpis(archetypeId) {
  switch (String(archetypeId)) {
    case "scheduler":
      return ["schedule_conflicts_resolved", "confirmation_latency"];
    case "analyst":
    case "reporting_analyst":
      return ["report_freshness", "insight_usefulness"];
    default:
      return ["queue_throughput", "escalation_quality"];
  }
}

function defaultKnowledgeOwnership(archetypeId) {
  switch (String(archetypeId)) {
    case "document_specialist":
      return ["sops", "handbook"];
    case "compliance_reviewer":
      return ["policies", "consent"];
    case "campaign_coordinator":
    case "marketing_coordinator":
      return ["brand_voice", "campaign_templates"];
    default:
      return ["operating_notes"];
  }
}

function suggestAlternativeArchetypes(archetypeId) {
  const known = listEmployeeArchetypeIds();
  const preferences = {
    scheduler: ["coordinator", "operations_coordinator"],
    intake_specialist: ["coordinator", "customer_success_coordinator"],
    analyst: ["reporting_analyst", "operations_monitor"],
    reviewer: ["quality_reviewer", "compliance_reviewer"],
    communications_specialist: ["follow_up_specialist", "customer_success_coordinator"],
  };
  const preferred = preferences[String(archetypeId)] ?? ["coordinator", "operations_monitor", "reviewer"];
  return preferred.filter((id) => known.includes(id) && id !== archetypeId).slice(0, 3);
}
