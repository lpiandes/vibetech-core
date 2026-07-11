import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { buildBusinessOSNavigation } from "../business-os/BusinessOSNavigationBuilder.js";
import { DashboardRecommendationEngine } from "./DashboardRecommendationEngine.js";
import { explainBusinessOSSpecification } from "../business-os/BusinessOSExplanationProjection.js";

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
      headline: explanation.summary,
      bullets: explanation.sections.find((section) => section.id === "profile")
        ? [explanation.sections.find((section) => section.id === "profile").body]
        : [],
    },
    navigation: {
      title: "Navigation",
      headline: "You will have these workspaces",
      items: navigation.primaryItems
        .filter((item) => item.moduleId !== "more")
        .map((item) => ({ id: item.moduleId, label: item.label })),
      overflow: navigation.overflowItems.map((item) => item.label),
      note: "Digital employees stay under Digital Workforce — not as separate tabs.",
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
      headline: "These digital employees will help",
      items: (specification.employeeDefinitions ?? []).map((employee) => ({
        id: employee.employeeId,
        label: employee.label,
        purpose: employee.purpose,
        responsibilities: employee.responsibilities ?? employee.duties ?? [
          employee.purpose,
        ].filter(Boolean),
        approvals: employee.approvalRequirements ?? [],
        knowledgeNeeded: employee.requiredKnowledge ?? [],
        integrationsNeeded: employee.requiredIntegrations ?? [],
        readiness: employee.readinessState ?? "needs setup",
        escalation: employee.escalationRules ?? "Escalate to the owner when unsure.",
      })),
    },
    rolesAccess: {
      title: "Roles & Access",
      headline: "Who can see what",
      items: (specification.roleDefinitions ?? []).map((role) => ({
        id: role.roleId,
        label: role.label,
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
    explanation,
    navigationPreview: navigation,
    views,
    progress: session?.progress ?? null,
    assumptions: session?.assumptions ?? specification.assumptions ?? [],
    unresolvedQuestions: session?.unresolvedQuestions ?? [],
    nextAction: session?.progress?.readyForProposal
      ? "Review the proposal, then run a dry run before install."
      : "Answer the remaining questions to unlock a proposal.",
  });
}
