/**
 * Architect blueprint compiler — validated configuration, never customer codegen.
 * Selects vertical pack → validates against capability registry → returns installable blueprint.
 */
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { getOperatingPack, operatingPackContract } from "../../ai-builder/OperatingPackRegistry.js";
import { listCapabilitiesForVertical } from "../capabilities/PlatformCapabilityStatusRegistry.js";
import { isPropertyManagementWorkspace } from "../vertical/SurfaceInventory.js";

const SUPPORTED_VERTICALS = Object.freeze(["sports", "dental", "property_management"]);

/**
 * Compile a validated Business Blueprint from owner answers / pack selection.
 */
export function compileVerticalBlueprint({
  vertical,
  workspaces = null,
  pipelines = null,
  aiTeammates = null,
  workflows = null,
  integrations = null,
  requiredKnowledge = null,
} = {}) {
  const v = normalizeVertical(vertical);
  if (!SUPPORTED_VERTICALS.includes(v)) {
    return deepFreeze({
      ok: false,
      errors: [`Unsupported vertical: ${vertical}. Supported: ${SUPPORTED_VERTICALS.join(", ")}`],
    });
  }

  if (v === "property_management") {
    return deepFreeze({
      ok: true,
      blueprint: {
        vertical: "property_management",
        packId: null,
        industryPackageId: "pkg_property_management",
        workspaces: workspaces ?? ["Home", "People", "Properties", "Work", "Knowledge"],
        pipelines: pipelines ?? ["Prospect intake", "Maintenance"],
        aiTeammates: aiTeammates ?? ["Resident & Prospect Coordinator", "Maintenance Coordinator"],
        workflows: workflows ?? ["prospect_follow_up", "maintenance_ack"],
        integrations: integrations ?? ["business_email", "calendar", "property_management_system"],
        requiredKnowledge: requiredKnowledge ?? ["Policies", "SOPs", "Pricing"],
        modules: ["home", "people", "properties", "work", "knowledge", "inbox", "digital_workforce"],
      },
      prohibited: ["arbitrary_codegen", "per_customer_ui"],
    });
  }

  const pack = getOperatingPack(v);
  const contract = operatingPackContract(v);
  if (!pack) {
    return deepFreeze({ ok: false, errors: [`No operating pack for vertical: ${v}`] });
  }

  const caps = listCapabilitiesForVertical(v);
  const requiredCapIds = caps.filter((c) => c.requiredIntegrations?.length).map((c) => c.id);

  const blueprint = {
    vertical: v,
    packId: pack.packId,
    packVersion: pack.version,
    lifecycle: pack.lifecycle,
    workspaces: workspaces ?? defaultWorkspaces(v),
    pipelines: pipelines ?? pack.pipelines.map((p) => p.label),
    pipelineDefs: pack.pipelines,
    aiTeammates: aiTeammates ?? pack.aiRoles,
    workflows: workflows ?? pack.workflowIds,
    integrations: integrations ?? defaultIntegrations(v),
    requiredKnowledge: requiredKnowledge ?? defaultKnowledge(v),
    recordTypes: pack.recordTypes,
    dashboardSignals: pack.dashboardSignals,
    compliance: pack.compliance,
    sharedCapabilities: contract.sharedCapabilities,
    capabilityIds: requiredCapIds,
    modules: ["home", "people", "work", "knowledge", "inbox", "digital_workforce", "integrations"],
  };

  const validation = validateBlueprintAgainstCapabilities(blueprint);
  if (!validation.ok) {
    return deepFreeze({ ok: false, errors: validation.errors, blueprint });
  }

  return deepFreeze({
    ok: true,
    blueprint,
    prohibited: ["arbitrary_codegen", "per_customer_ui", "silent_outbound"],
    installPlan: {
      operatingPackId: pack.packId,
      industryPackageId: null,
      quarantinePm: true,
      note: "Install as configuration on universal OS — never generate tenant code.",
    },
  });
}

export function validateBlueprintAgainstCapabilities(blueprint) {
  const errors = [];
  const v = normalizeVertical(blueprint?.vertical);
  const caps = listCapabilitiesForVertical(v);
  const integrations = new Set((blueprint?.integrations ?? []).map(String));

  if (isPropertyManagementWorkspace({ industry: v }) === false) {
    if (integrations.has("property_management_system")) {
      errors.push("property_management_system is quarantined from sports/dental blueprints");
    }
    if ((blueprint?.modules ?? []).includes("properties")) {
      errors.push("properties module is quarantined from sports/dental blueprints");
    }
  }

  for (const conn of integrations) {
    if (conn === "voice_channel") {
      // Allowed in blueprint as optional, but capability stays unsupported until E2E.
      continue;
    }
    if (conn === "property_management_system" && v !== "property_management") {
      errors.push(`Integration ${conn} not valid for vertical ${v}`);
    }
  }

  if (!blueprint?.pipelines?.length) errors.push("Blueprint requires at least one pipeline");
  if (!blueprint?.aiTeammates?.length) errors.push("Blueprint requires at least one AI teammate");
  if (!caps.length) errors.push("No capabilities registered for vertical");

  return deepFreeze({ ok: errors.length === 0, errors });
}

function normalizeVertical(vertical) {
  const v = String(vertical ?? "").trim().toLowerCase();
  if (v === "youth_sports" || v === "sports_club" || v === "youth_sports_v1") return "sports";
  if (v === "dental_v1" || v === "general_dentistry") return "dental";
  if (v === "pm" || v === "property" || v === "property-management") return "property_management";
  return v;
}

function defaultWorkspaces(vertical) {
  if (vertical === "sports") return ["Club HQ", "Teams", "Rosters", "Schedule", "Work", "Knowledge"];
  if (vertical === "dental") return ["Practice HQ", "Patients", "Schedule", "Work", "Knowledge"];
  return ["Home", "People", "Work", "Knowledge"];
}

function defaultIntegrations(vertical) {
  if (vertical === "sports") return ["business_email", "calendar", "sms_channel", "meta_lead_ads"];
  if (vertical === "dental") return ["business_email", "calendar", "sms_channel"];
  return ["business_email"];
}

function defaultKnowledge(vertical) {
  if (vertical === "sports") return ["Club policies", "Registration details", "Curriculum"];
  if (vertical === "dental") return ["Office policies", "Intake scripts", "Brand voice"];
  return ["Policies", "SOPs"];
}
