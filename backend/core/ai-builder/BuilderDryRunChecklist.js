import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { humanizeStatus } from "./BuilderUxPresentation.js";

/**
 * Turn a compiled installation plan / dry-run into a client-readable checklist.
 */
export function buildDryRunChecklist({ plan = null, dryRunResult = null, specification = null } = {}) {
  const operations = dryRunResult?.simulatedOperations
    ?? dryRunResult?.simulatedActions
    ?? plan?.operations
    ?? plan?.actions
    ?? [];

  const counts = {
    workspaces: 0,
    roles: 0,
    employees: 0,
    dashboards: 0,
    workflows: 0,
    knowledge: 0,
    integrations: 0,
    campaigns: 0,
    deferred: 0,
    setup: 0,
    gaps: 0,
  };

  for (const operation of operations) {
    const type = String(operation.operationType ?? operation.type ?? "").toUpperCase();
    const outcome = String(operation.outcome ?? operation.status ?? "would_apply");
    if (outcome === "deferred" || operation.deferred) counts.deferred += 1;
    else if (outcome === "requires_setup" || operation.requiresSetup) counts.setup += 1;
    else if (/GAP|UNSUPPORTED|REQUIRE_PLATFORM/.test(type)) counts.gaps += 1;
    else if (/MODULE|NAVIGATION|WORKSPACE/.test(type)) counts.workspaces += 1;
    else if (/ROLE|PERMISSION|ACCESS/.test(type)) counts.roles += 1;
    else if (/EMPLOYEE|WORKFORCE/.test(type)) counts.employees += 1;
    else if (/DASHBOARD/.test(type)) counts.dashboards += 1;
    else if (/WORKFLOW|WORK_TYPE|REQUEST/.test(type)) counts.workflows += 1;
    else if (/KNOWLEDGE/.test(type)) counts.knowledge += 1;
    else if (/INTEGRATION|CONNECTION/.test(type)) counts.integrations += 1;
    else if (/CAMPAIGN/.test(type)) counts.campaigns += 1;
    else if (/MODULE/.test(type)) counts.workspaces += 1;
  }

  // Fall back to specification counts when operations are sparse.
  if (!operations.length && specification) {
    counts.workspaces = specification.modules?.length ?? 0;
    counts.roles = specification.roleDefinitions?.length ?? 0;
    counts.employees = specification.employeeDefinitions?.length ?? 0;
    counts.dashboards = specification.dashboardDefinitions?.length ?? 1;
    counts.workflows = specification.workflowDefinitions?.length ?? 0;
    counts.knowledge = specification.knowledgeRequirements?.length ?? 0;
    counts.integrations = specification.integrationRequirements?.length ?? 0;
    counts.campaigns = specification.campaignDefinitions?.length ?? 0;
    counts.gaps = specification.capabilityGaps?.length ?? 0;
  }

  const items = [
    checklistItem("workspaces", `Creating ${counts.workspaces} workspaces`, counts.workspaces, "ready"),
    checklistItem("roles", `Configuring ${counts.roles} roles`, counts.roles, "ready"),
    checklistItem("employees", `Installing ${counts.employees} digital employees`, counts.employees, "ready"),
    checklistItem("dashboards", `Preparing ${counts.dashboards} dashboards`, counts.dashboards, "ready"),
    checklistItem("workflows", `Registering ${counts.workflows} workflows`, counts.workflows, "ready"),
    checklistItem("knowledge", `Adding ${counts.knowledge} Knowledge requirements`, counts.knowledge, "ready"),
    checklistItem("integrations", `Requiring ${counts.integrations} integrations`, counts.integrations, counts.integrations ? "needs_setup" : "ready"),
    checklistItem("campaigns", `Preparing ${counts.campaigns} campaigns`, counts.campaigns, "requires_approval"),
    checklistItem("setup", `${counts.setup} items need setup before go-live`, counts.setup, "needs_setup"),
    checklistItem("deferred", `Deferring ${counts.deferred} items for later`, counts.deferred, "deferred"),
    checklistItem("gaps", `${counts.gaps} capabilities are not available yet`, counts.gaps, "unsupported"),
  ].filter((item) => item.count > 0 || ["workspaces", "roles", "employees"].includes(item.id));

  return deepFreeze({
    headline: "Here is what installation would do",
    mutated: dryRunResult?.mutated === true,
    ready: dryRunResult?.ok !== false,
    items,
    warnings: (dryRunResult?.readiness?.warnings ?? []).map((entry) => (
      typeof entry === "string" ? entry : entry.message ?? humanizeStatus(entry.code)
    )),
    blocking: (dryRunResult?.readiness?.blocking ?? []).map((entry) => (
      typeof entry === "string" ? entry : entry.message ?? humanizeStatus(entry.code)
    )),
  });
}

function checklistItem(id, label, count, status) {
  return deepFreeze({
    id,
    label,
    count: Number(count) || 0,
    status,
    statusLabel: humanizeStatus(status),
  });
}
