import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { buildBusinessOSNavigation } from "../business-os/BusinessOSNavigationBuilder.js";
import { BusinessOSCompiler } from "../business-os/BusinessOSCompiler.js";
import { evaluateBusinessOSInstallReadiness } from "../business-os/BusinessOSReadinessEvaluator.js";

const FORBIDDEN_CLIENT_TERMS = [
  "BusinessSubject",
  "BusinessGraph",
  "runtime snapshot",
  "schema JSON",
  "INSTALL_",
  "capabilityId",
  "specificationContentHash",
  "Postgres",
  "JSONB",
];

/**
 * Client-safe proposal / review projection.
 * Never exposes technical internals.
 */
export function buildBusinessBuilderReviewProjection({
  session,
  specification,
  plan = null,
  capabilityProposals = [],
  dryRunResult = null,
} = {}) {
  const compiled = plan ?? (specification ? new BusinessOSCompiler().compile(specification).plan : null);
  const navigation = specification
    ? buildBusinessOSNavigation({ modules: specification.modules, navigation: specification.navigation })
    : null;
  const readiness = evaluateBusinessOSInstallReadiness({
    specification,
    plan: compiled,
    dryRunCompleted: Boolean(dryRunResult?.ok),
    approved: session?.status === "approved" || session?.status === "installed",
  });

  const profile = specification?.businessProfile ?? {};
  const projection = {
    sessionId: session?.sessionId ?? null,
    status: session?.status ?? "discovery",
    sections: {
      understood: {
        title: "What VIBETech understood",
        businessName: profile.businessName ?? session?.businessName ?? null,
        industry: profile.industry ?? null,
        services: profile.services ?? [],
        customerTypes: profile.customerTypes ?? [],
        painPoints: profile.painPoints ?? [],
      },
      recommendedOS: {
        title: "Your recommended operating system",
        name: specification?.terminology?.operatingSystemTitle ?? "Business Operating System",
        summary: `A tailored operating system for ${profile.businessName ?? "this business"} using reusable VIBETech components.`,
      },
      workspaces: {
        title: "Main workspaces",
        items: (specification?.modules ?? [])
          .filter((module) => module.primaryNavigationEligible !== false)
          .map((module) => ({ label: module.label, description: module.description ?? "" })),
      },
      tracked: {
        title: "What VIBETech will track",
        items: (specification?.subjectDefinitions ?? []).map((entry) => entry.label),
        relationships: (specification?.relationshipDefinitions ?? []).map((entry) => entry.label),
      },
      workFlow: {
        title: "How work will flow",
        items: (specification?.workflowDefinitions ?? []).map((entry) => entry.label ?? entry.workflowId),
        requests: (specification?.requestDefinitions ?? []).map((entry) => entry.label),
      },
      digitalWorkforce: {
        title: "Digital workforce",
        placement: "Grouped under Team / Digital Workforce — not separate sidebar tabs.",
        employees: (specification?.employeeDefinitions ?? []).map((employee) => ({
          label: employee.label,
          purpose: employee.purpose,
        })),
      },
      dashboards: {
        title: "Dashboards",
        items: (specification?.dashboardDefinitions ?? []).map((dashboard) => ({
          label: dashboard.label,
          widgets: (dashboard.widgets ?? []).map((widget) => widget.label ?? widget.componentType),
        })),
      },
      communications: {
        title: "Communications and campaigns",
        campaigns: (specification?.campaignDefinitions ?? []).map((entry) => entry.label),
        approvalsRequired: true,
      },
      knowledge: {
        title: "Knowledge needed",
        items: (specification?.knowledgeRequirements ?? []).map((entry) =>
          String(entry.label ?? entry.categoryId ?? "")
            .replace(/_/g, " ")
            .replace(/\bPM\b/g, "Property")
        ),
      },
      connections: {
        title: "Connections needed",
        items: (specification?.integrationRequirements ?? []).map((entry) => ({
          label: entry.label,
          status: humanStatus(entry.status),
        })),
      },
      approvals: {
        title: "What requires approval",
        items: (specification?.governancePolicies ?? []).map((entry) => entry.label),
      },
      ready: {
        title: "What is ready",
        items: (compiled?.capabilityResolutions ?? [])
          .filter((entry) => entry.availability === "supported")
          .map((entry) => entry.label),
      },
      setup: {
        title: "What requires setup",
        items: (compiled?.actions ?? [])
          .filter((action) => action.requiresSetup || action.type === "REQUIRE_SETUP")
          .map((action) => action.explanation),
      },
      cannotDoYet: {
        title: "What VIBETech cannot do yet",
        items: [
          ...(compiled?.actions ?? [])
            .filter((action) => action.type === "REQUIRE_PLATFORM_CAPABILITY")
            .map((action) => action.explanation),
          ...(capabilityProposals ?? []).map((proposal) => proposal.requestedOutcome),
          ...(compiled?.actions ?? [])
            .filter((action) => action.deferred)
            .map((action) => action.explanation),
        ],
      },
      openQuestions: {
        title: "Questions still needing answers",
        items: (compiled?.unresolvedQuestions ?? []).map((entry) => entry.question),
      },
    },
    navigationPreview: navigation
      ? {
          primary: navigation.primaryItems.map((item) => item.label),
          overflow: (navigation.overflowItems ?? []).map((item) => item.label),
          employeePlacement: navigation.employeePlacement,
        }
      : null,
    dryRun: dryRunResult
      ? {
          completed: Boolean(dryRunResult.ok),
          mutated: Boolean(dryRunResult.mutated),
          actionSummaries: (dryRunResult.simulatedActions ?? []).map((action) => ({
            label: action.type.replace(/_/g, " ").toLowerCase(),
            outcome: humanOutcome(action.outcome),
            explanation: action.explanation,
          })),
        }
      : null,
    readiness: {
      state: readiness.state,
      warnings: readiness.warnings.map((entry) => entry.message),
      blocking: readiness.blocking.map((entry) => entry.message),
    },
  };

  const blob = JSON.stringify(projection);
  for (const term of FORBIDDEN_CLIENT_TERMS) {
    if (blob.includes(term)) {
      throw new Error(`BusinessBuilderReviewProjection leaked technical term: ${term}`);
    }
  }

  return deepFreeze(projection);
}

function humanStatus(status) {
  if (status === "deferred") return "Deferred";
  if (status === "required") return "Required";
  if (status === "optional") return "Optional";
  return "Needs review";
}

function humanOutcome(outcome) {
  if (outcome === "would_apply") return "Would apply";
  if (outcome === "requires_setup") return "Needs setup";
  if (outcome === "deferred") return "Deferred";
  return String(outcome ?? "Review");
}
