import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { buildBusinessOSNavigation } from "../business-os/BusinessOSNavigationBuilder.js";
import { DashboardRecommendationEngine } from "./DashboardRecommendationEngine.js";
import { explainBusinessOSSpecification } from "../business-os/BusinessOSExplanationProjection.js";
import { scrubOwnerFacingPurpose } from "./businessIdentity.js";

/**
 * Client-safe visual proposal — plain language, no raw JSON by default.
 */
export function buildVisualBusinessOSProposal({
  session,
  specification,
  assemblyPlan = null,
  businessId = "preview",
} = {}) {
  const explanation = explainBusinessOSSpecification(specification);
  const navOverrides = session?.appearance?.navigationOverrides ?? {};
  const employeeOverrides = session?.appearance?.employeeOverrides ?? {};
  const roleOverrides = session?.appearance?.roleOverrides ?? {};
  const sectionOverrides = session?.appearance?.sectionOverrides ?? {};
  const planAdditions = session?.appearance?.planAdditions ?? { modules: [], employees: [] };
  const addedModules = Array.isArray(planAdditions.modules) ? planAdditions.modules : [];
  const addedEmployees = Array.isArray(planAdditions.employees) ? planAdditions.employees : [];

  const explanationWithOverrides = {
    ...explanation,
    sections: (explanation.sections ?? []).map((section) => ({
      ...section,
      body: sectionOverrides?.[section.id]?.body ?? section.body,
      title: sectionOverrides?.[section.id]?.title ?? section.title,
    })),
  };

  const navigation = buildBusinessOSNavigation({
    modules: specification.modules,
    navigation: { ...specification.navigation, primaryItems: [], maximumPrimaryItems: 7 },
    businessId,
  });
  const dashboard = new DashboardRecommendationEngine().recommend({
    businessSummary: specification.businessProfile,
    modules: specification.modules,
  }).dashboard;

  const views = {
    overview: {
      title: "Overview",
      headline: explanationWithOverrides.summary,
      bullets: explanationWithOverrides.sections.find((section) => section.id === "profile")
        ? [explanationWithOverrides.sections.find((section) => section.id === "profile").body]
        : [],
    },
    navigation: {
      title: "Workspaces",
      headline: "You will have these workspaces — rename any of them",
      items: [
        ...navigation.primaryItems
          .filter((item) => item.moduleId !== "more")
          .filter((item) => !navOverrides?.hidden?.[item.moduleId])
          .map((item) => ({
            id: item.moduleId,
            label: navOverrides?.labels?.[item.moduleId] ?? item.label,
          })),
        ...addedModules
          .filter((item) => item?.id && !navOverrides?.hidden?.[item.id])
          .map((item) => ({
            id: String(item.id),
            label: String(item.label ?? item.id),
            ownerAdded: true,
          })),
      ],
      overflow: navigation.overflowItems.map((item) => item.label),
      note: "Digital Workforce is where your AI employees live. Rename workspaces anytime before you go live.",
    },
    dashboard: {
      title: "Dashboard",
      headline: "Your home view",
      cards: dashboard.cards.map((card) => ({
        id: card.id,
        title: card.title,
        emptyState: card.emptyState,
      })),
    },
    workflows: {
      title: "Workflows",
      items: (specification.workflowDefinitions ?? []).map((entry) => ({
        id: entry.workflowId,
        label: entry.label,
      })),
    },
    digitalWorkforce: {
      title: "Digital Workforce",
      headline: "These digital employees will help run the business — rename or rewrite their focus",
      items: [
        ...(specification.employeeDefinitions ?? [])
          .filter((employee) => !employeeOverrides?.hidden?.[employee.employeeId])
          .map((employee) => ({
            id: employee.employeeId,
            label: employeeOverrides?.labels?.[employee.employeeId] ?? employee.label,
            purpose: scrubOwnerFacingPurpose(
              employeeOverrides?.purposes?.[employee.employeeId] ?? employee.purpose,
              {
                businessName: specification.businessProfile?.businessName,
                industry: specification.businessProfile?.industry,
                roleLabel: employeeOverrides?.labels?.[employee.employeeId] ?? employee.label,
              },
            ),
            responsibilities: employee.responsibilities ?? employee.duties ?? [
              employeeOverrides?.purposes?.[employee.employeeId] ?? employee.purpose,
            ].filter(Boolean),
            approvals: employee.approvalRequirements ?? [],
            knowledgeNeeded: employee.requiredKnowledge ?? [],
            integrationsNeeded: employee.requiredIntegrations ?? [],
            readiness: employee.readinessState ?? "needs setup",
            escalation: employee.escalationRules ?? "Escalate to the owner when unsure.",
          })),
        ...addedEmployees
          .filter((employee) => employee?.id && !employeeOverrides?.hidden?.[employee.id])
          .map((employee) => ({
            id: String(employee.id),
            label: String(employee.label ?? employee.id),
            purpose: String(employee.purpose ?? `Owner-requested teammate.`),
            responsibilities: [employee.purpose].filter(Boolean),
            approvals: ["human_approval"],
            knowledgeNeeded: [],
            integrationsNeeded: [],
            readiness: "owner_requested",
            escalation: "Escalate to the owner when unsure.",
            ownerAdded: true,
          })),
      ],
    },
    rolesAccess: {
      title: "Roles & Access",
      headline: "Who can see what — rename roles if you want",
      items: (specification.roleDefinitions ?? []).map((role) => ({
        id: role.roleId,
        label: roleOverrides?.labels?.[role.roleId] ?? role.label,
        modules: (role.moduleVisibility ?? [])
          .map((moduleId) => specification.modules?.find((module) => module.moduleId === moduleId)?.label ?? moduleId),
        denied: (role.deniedModules ?? [])
          .map((moduleId) => specification.modules?.find((module) => module.moduleId === moduleId)?.label ?? moduleId),
      })),
    },
    communications: {
      title: "Communications",
      items: (specification.integrationRequirements ?? [])
        .filter((entry) => /email|inbox|sms|phone/i.test(entry.integrationId ?? entry.label ?? ""))
        .map((entry) => ({ id: entry.integrationId, label: entry.label, status: entry.status })),
    },
    campaigns: {
      title: "Campaigns",
      headline: "These actions require your approval before send",
      items: (specification.campaignDefinitions ?? []).map((entry) => ({
        id: entry.campaignTemplateId,
        label: entry.label,
        approvalRequired: entry.approvalRequired !== false,
      })),
    },
    knowledge: {
      title: "Knowledge",
      items: (specification.knowledgeRequirements ?? []).map((entry) => ({
        id: entry.categoryId,
        label: entry.categoryId,
        required: entry.required !== false,
      })),
    },
    integrations: {
      title: "Integrations",
      headline: "These integrations still need setup",
      items: (specification.integrationRequirements ?? []).map((entry) => ({
        id: entry.integrationId,
        label: entry.label,
        status: entry.status,
      })),
    },
    reports: {
      title: "Reports",
      items: (specification.dashboardDefinitions ?? [])
        .filter((entry) => /report|performance/i.test(entry.dashboardId ?? entry.label ?? ""))
        .map((entry) => ({ id: entry.dashboardId, label: entry.label })),
    },
    readiness: {
      title: "Readiness",
      items: (specification.readinessRequirements ?? []).map((entry) => ({
        id: entry.requirementId,
        label: entry.label,
        required: entry.requiredForLaunch !== false,
      })),
    },
    capabilityGaps: {
      title: "Capability Gaps",
      headline: "These capabilities are not available yet",
      items: (assemblyPlan?.capabilityGaps ?? specification.capabilityGaps ?? []).map((gap) => ({
        id: gap.gapId ?? gap.capabilityId ?? gap.id,
        label: gap.label,
        kind: gap.kind ?? "deferred",
      })),
    },
  };

  return deepFreeze({
    businessName: specification.businessProfile?.businessName ?? session?.businessSummary?.businessName ?? "Your business",
    accentColor: session?.appearance?.accentColor ?? "#0F766E",
    explanation: explanationWithOverrides,
    navigationPreview: navigation,
    views,
    progress: session?.progress ?? null,
    assumptions: session?.assumptions ?? specification.assumptions ?? [],
    unresolvedQuestions: session?.unresolvedQuestions ?? [],
    nextAction: session?.progress?.readyForProposal
      ? "Review the proposal, then check launch readiness before you go live."
      : "Answer the remaining questions to unlock a proposal.",
  });
}
