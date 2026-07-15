import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { humanizeStatus } from "./BuilderUxPresentation.js";
import {
  SETUP_GUIDES_BY_CAPABILITY,
  SETUP_GUIDES_BY_INTEGRATION,
  SETUP_GUIDES_BY_STEP,
  matchGuideFromText,
} from "./setupWalkthroughGuides.js";

/**
 * Client-readable readiness checklist with named items + concrete setup walkthrough.
 */
export function buildDryRunChecklist({ plan = null, dryRunResult = null, specification = null } = {}) {
  const operations = dryRunResult?.simulatedOperations
    ?? dryRunResult?.simulatedActions
    ?? plan?.operations
    ?? plan?.actions
    ?? [];

  const workspaces = labelsFromSpec(
    specification?.modules?.map((entry) => entry.label ?? entry.moduleId),
  );
  const roles = labelsFromSpec(
    specification?.roleDefinitions?.map((entry) => entry.label ?? entry.roleId),
  );
  const employees = labelsFromSpec(
    specification?.employeeDefinitions?.map((entry) => entry.label ?? entry.employeeId),
  );
  const dashboards = labelsFromSpec(
    specification?.dashboardDefinitions?.map((entry) => entry.label ?? entry.dashboardId),
  );
  const workflows = labelsFromSpec([
    ...(specification?.workflowDefinitions ?? []).map((entry) => entry.label ?? entry.workflowId),
    ...(specification?.workDefinitions ?? []).map((entry) => entry.label ?? entry.workType),
  ]);
  const knowledge = labelsFromSpec(
    specification?.knowledgeRequirements?.map((entry) => humanKnowledgeLabel(entry)),
  );
  const campaigns = labelsFromSpec(
    specification?.campaignDefinitions?.map((entry) => entry.label ?? entry.campaignTemplateId),
  );

  // Fall back to operation labels only when the specification lacked names.
  const workspacesFinal = workspaces.length ? workspaces : labelsFromOps(operations, /MODULE|NAVIGATION|WORKSPACE/i);
  const rolesFinal = roles.length ? roles : labelsFromOps(operations, /ROLE|PERMISSION|ACCESS/i);
  const employeesFinal = employees.length ? employees : labelsFromOps(operations, /EMPLOYEE|WORKFORCE/i);
  const dashboardsFinal = dashboards.length
    ? dashboards
    : (labelsFromOps(operations, /DASHBOARD/i).length
      ? labelsFromOps(operations, /DASHBOARD/i)
      : (specification || operations.length ? ["Owner home"] : []));
  const workflowsFinal = workflows.length ? workflows : labelsFromOps(operations, /WORKFLOW|WORK_TYPE|REQUEST/i);
  const knowledgeFinal = knowledge.length ? knowledge : labelsFromOps(operations, /KNOWLEDGE/i);
  const campaignsFinal = campaigns.length ? campaigns : labelsFromOps(operations, /CAMPAIGN/i);

  const deferredOps = operations.filter((op) => op.deferred || String(op.outcome ?? "") === "deferred");
  const gapOps = operations.filter((op) => /REQUIRE_PLATFORM_CAPABILITY/i.test(typeOf(op)));
  // Connection / setup gaps belong in the walkthrough, not “not available yet”.
  const specGaps = (specification?.capabilityGaps ?? [])
    .filter((entry) => !isSetupCoveredGap(entry))
    .map((entry) => entry.label ?? entry.message ?? entry.capabilityId ?? entry.id)
    .filter(Boolean);

  const items = [
    readyItem("workspaces", "Workspaces", workspacesFinal, "These are the places your team will work day to day."),
    readyItem("roles", "Roles", rolesFinal, "Who can see and do what."),
    readyItem("employees", "AI teammates", employeesFinal, "Digital employees that will help run the business."),
    readyItem("dashboards", "Home screens", dashboardsFinal, "What owners see when they open the business."),
    readyItem("workflows", "Workflows", workflowsFinal, "Repeatable work queues and operating loops."),
    readyItem("knowledge", "Knowledge needs", knowledgeFinal, "Facts and documents teammates need before they can draft accurately."),
    readyItem("campaigns", "Campaigns", campaignsFinal, "Outreach drafts that always wait for your approval."),
  ].filter((item) => item.details.length > 0);

  if (deferredOps.length) {
    items.push(readyItem(
      "deferred",
      "Later",
      deferredOps.map((op) => cleanOpLabel(op)).filter(Boolean),
      "Deferred until the platform capability is ready.",
      "deferred",
    ));
  }
  const gapLabels = [...new Set([...specGaps, ...gapOps.map((op) => cleanOpLabel(op)).filter(Boolean)])];
  if (gapLabels.length) {
    items.push(readyItem(
      "gaps",
      "Not available yet",
      gapLabels,
      "These are honest gaps — VIBETech will not pretend they are live.",
      "unsupported",
    ));
  }

  const setupWalkthrough = buildSetupWalkthrough({
    specification,
    operations,
    dryRunResult,
    plan,
  });

  const readinessWarnings = (dryRunResult?.readiness?.warnings ?? []).flatMap((entry) => {
    if (typeof entry === "string") return [entry];
    if (Array.isArray(entry.items) && entry.items.length) {
      return entry.items.map((item) => String(item));
    }
    return [entry.message ?? humanizeStatus(entry.code)].filter(Boolean);
  });

  return deepFreeze({
    headline: "What VIBETech will set up",
    mutated: dryRunResult?.mutated === true,
    ready: dryRunResult?.ok !== false,
    items,
    setupWalkthrough,
    // Kept for older clients; UI should prefer setupWalkthrough.
    warnings: readinessWarnings,
    blocking: (dryRunResult?.readiness?.blocking ?? []).map((entry) => (
      typeof entry === "string" ? entry : entry.message ?? humanizeStatus(entry.code)
    )),
  });
}

function buildSetupWalkthrough({ specification, operations, dryRunResult, plan }) {
  const steps = [];
  const seen = new Set();

  const pushStep = (step) => {
    if (!step?.id || seen.has(step.id)) return;
    seen.add(step.id);
    steps.push(step);
  };

  // Spec-driven connections / required setup first (most actionable for owners).
  for (const integration of specification?.integrationRequirements ?? []) {
    const status = String(integration?.status ?? "required").toLowerCase();
    if (status === "deferred" || status === "optional") continue;
    const guide = SETUP_GUIDES_BY_INTEGRATION[String(integration.integrationId ?? integration.id ?? "").toLowerCase()]
      ?? guideFromLabel(integration.label ?? integration.integrationId);
    if (guide) pushStep(guide);
  }

  for (const stepId of specification?.metadata?.requiredSetupSteps ?? []) {
    const guide = SETUP_GUIDES_BY_STEP[String(stepId)];
    if (guide) pushStep(guide);
  }

  // Capability-driven setup (e.g. scheduling needing calendar).
  for (const requirement of specification?.capabilityRequirements ?? []) {
    const capabilityId = String(requirement?.capabilityId ?? "");
    const guide = SETUP_GUIDES_BY_CAPABILITY[capabilityId];
    if (guide) pushStep(guide);
  }

  // Compiler REQUIRE_SETUP actions — map known labels into guided steps.
  const setupActions = [
    ...operations.filter((op) => op.requiresSetup || String(op.outcome ?? "") === "requires_setup" || typeOf(op) === "REQUIRE_SETUP"),
    ...(plan?.actions ?? []).filter((action) => action.requiresSetup || action.type === "REQUIRE_SETUP"),
  ];
  for (const action of setupActions) {
    const text = `${action.label ?? ""} ${action.explanation ?? ""} ${action.setupId ?? ""}`;
    const matched = matchGuideFromText(text);
    if (matched) pushStep(matched);
    else {
      pushStep({
        id: `setup_${slug(action.label ?? action.setupId ?? typeOf(action))}`,
        title: String(action.label ?? "Finish setup"),
        summary: String(action.explanation ?? "Needs connection or configuration after install."),
        inApp: [
          "After go-live, open Connections from the left nav (or Settings → Connections).",
          "Complete any card marked needs setup for this item.",
        ],
        external: [],
        whereInApp: "Connections",
      });
    }
  }

  // Knowledge + team — always common post-install steps when mentioned.
  if ((specification?.knowledgeRequirements ?? []).length) {
    pushStep(SETUP_GUIDES_BY_STEP.knowledge);
  }
  if ((specification?.readinessRequirements ?? []).some((entry) => /team/i.test(entry.requirementId ?? entry.label ?? ""))) {
    pushStep(SETUP_GUIDES_BY_STEP.team);
  }

  // Deduplicate fuzzy overlaps from readiness warning dump is no longer needed — we return structured steps.
  void dryRunResult;
  return steps;
}

function guideFromLabel(label) {
  return matchGuideFromText(String(label ?? ""));
}

function labelsFromSpec(values = []) {
  return [...new Set((values ?? []).map((entry) => String(entry ?? "").trim()).filter(Boolean))];
}

function labelsFromOps(operations = [], typePattern) {
  return [...new Set(
    (operations ?? [])
      .filter((op) => typePattern.test(typeOf(op)))
      .map((op) => cleanOpLabel(op))
      .filter(Boolean),
  )];
}

function cleanOpLabel(operation) {
  return String(operation?.label ?? operation?.payload?.label ?? "")
    .replace(/^(Configure|Install|Add|Require|Support|Connect)\s+/i, "")
    .replace(/^role:\s*/i, "")
    .replace(/^knowledge:\s*/i, "")
    .trim();
}

function humanKnowledgeLabel(entry) {
  if (entry?.label) return String(entry.label);
  const raw = String(entry?.categoryId ?? entry?.requirementId ?? "").replace(/_/g, " ").trim();
  if (!raw) return "";
  return raw.replace(/\b\w/g, (char) => char.toUpperCase());
}

function isSetupCoveredGap(entry) {
  const kind = String(entry?.kind ?? "").toLowerCase();
  if (kind.includes("provider_integration") || kind.includes("setup")) return true;
  const haystack = `${entry?.label ?? ""} ${entry?.requestedOutcome ?? ""} ${entry?.gapId ?? ""}`.toLowerCase();
  return /email|calendar|sms|voice|phone|meta|facebook|twilio|a2p|inbox/.test(haystack);
}

function readyItem(id, title, details, summary, status = "ready") {
  const unique = [...new Set((details ?? []).map((entry) => String(entry).trim()).filter(Boolean))];
  return deepFreeze({
    id,
    title,
    label: unique.length
      ? `${title} (${unique.length}): ${unique.join(", ")}`
      : title,
    summary,
    details: unique,
    count: unique.length,
    status,
    statusLabel: humanizeStatus(status),
  });
}

function typeOf(operation) {
  return String(operation?.operationType ?? operation?.type ?? "").toUpperCase();
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "item";
}
