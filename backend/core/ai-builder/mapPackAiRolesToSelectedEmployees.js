import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  getOperatingPack,
  getPackDefaultRoles,
  resolveOperatingIndustry,
} from "./OperatingPackRegistry.js";
import { ensureEmployeeOperatingContract } from "./operating-contract/buildOperatingContract.js";

/**
 * Explicit label → archetype fallback for legacy string aiRoles.
 */
export const PACK_AI_ROLE_ARCHETYPES = Object.freeze({
  "Club Intake Coordinator": {
    archetypeId: "intake_specialist",
    purpose: "Qualify new player and family inquiries and route them into registration work for owner review.",
  },
  "Practice Plan Assistant": {
    archetypeId: "document_specialist",
    purpose: "Draft practice plans and drill notes from club knowledge for coach review before sharing.",
  },
  "Family Communications Coordinator": {
    archetypeId: "communications_specialist",
    purpose: "Prepare family messages and schedule updates for approval — nothing sends without you.",
  },
  "Dental Intake Coordinator": {
    archetypeId: "intake_specialist",
    purpose: "Qualify new patient inquiries and route them into intake work for owner review.",
  },
  "Recall Coordinator": {
    archetypeId: "follow_up_specialist",
    purpose: "Prepare recall and reactivation outreach drafts for approval before any patient send.",
  },
});

/**
 * @param {string[]|null|undefined} aiRoles
 */
export function mapPackAiRolesToEmployees(aiRoles = []) {
  const roles = Array.isArray(aiRoles) ? aiRoles : [];
  const matched = roles.map((rawLabel, index) => {
    const label = String(rawLabel ?? "").trim();
    const mapped = PACK_AI_ROLE_ARCHETYPES[label];
    return {
      archetypeId: mapped?.archetypeId ?? `pack_role_${index + 1}`,
      label: label || `Pack role ${index + 1}`,
      purpose: mapped?.purpose
        ?? "Vertical pack AI teammate. It prepares work for review and never sends without approval.",
    };
  }).filter((entry) => entry.label);
  return deepFreeze(matched);
}

/**
 * @param {string|null|undefined} industry
 */
export function packEmployeesForIndustry(industry) {
  const resolved = resolveOperatingIndustry({ industry }) ?? String(industry ?? "").trim().toLowerCase();
  const structured = getPackDefaultRoles(resolved);
  if (structured.length) {
    return deepFreeze(structured.map((role) => ({
      archetypeId: role.archetypeId,
      label: role.label,
      purpose: role.purpose,
      roleId: role.roleId,
      connectionDependencies: role.connectionDependencies ?? ["business_email"],
      packDefault: true,
    })));
  }
  const pack = getOperatingPack(resolved);
  if (!pack?.aiRoles?.length) return deepFreeze([]);
  return mapPackAiRolesToEmployees(pack.aiRoles);
}

function toRecommendation(entry, { source = "operating_pack" } = {}) {
  const prefix = source === "owner_request" ? "rec_owner_" : "rec_pack_";
  return {
    recommendationId: `${prefix}${entry.archetypeId}`,
    kind: "employee_archetype",
    label: entry.label,
    why: entry.purpose,
    selected: true,
    evidence: [`archetype:${entry.archetypeId}`, `source:${source}`],
    payload: {
      employee: {
        label: entry.label,
        purpose: entry.purpose,
        archetypeId: entry.archetypeId,
        packDefault: source === "operating_pack",
        roleId: entry.roleId ?? null,
        connectionDependencies: entry.connectionDependencies ?? ["business_email"],
        automationPath: entry.automationPath ?? null,
        trigger: entry.trigger ?? null,
        workflowText: entry.workflowText ?? null,
      },
      archetype: {
        archetypeId: entry.archetypeId,
        purpose: entry.purpose,
      },
    },
  };
}

/**
 * Pack defaults first, then owner-requested extras. Dedupe by archetypeId then label.
 */
export function mergePackAndOwnerEmployeeRecommendations({
  industry = null,
  ownerRequested = [],
} = {}) {
  const packEmployees = packEmployeesForIndustry(industry);
  const byKey = new Map();

  for (const entry of packEmployees) {
    byKey.set(`archetype:${entry.archetypeId}:${entry.label}`, {
      ...entry,
      _source: "operating_pack",
    });
  }
  for (const entry of ownerRequested) {
    const archetypeId = String(entry.archetypeId ?? "");
    const labelKey = `label:${String(entry.label ?? "").toLowerCase()}`;
    const archetypeKey = archetypeId
      ? `archetype:${archetypeId}:${entry.label ?? ""}`
      : null;
    // Prefer matching same archetype when owner restates a pack role.
    const packMatch = archetypeId
      ? [...byKey.entries()].find(([key, value]) => (
        key.startsWith(`archetype:${archetypeId}`) || value.archetypeId === archetypeId
      ))
      : null;
    if (packMatch) {
      const [key, prev] = packMatch;
      byKey.set(key, {
        ...prev,
        ...entry,
        label: entry.label ?? prev.label,
        purpose: entry.purpose ?? prev.purpose,
        automationPath: entry.automationPath ?? prev.automationPath ?? null,
        trigger: entry.trigger ?? prev.trigger ?? null,
        workflowText: entry.workflowText ?? prev.workflowText ?? null,
        _source: "owner_request",
      });
      continue;
    }
    if (byKey.has(labelKey)) {
      const prev = byKey.get(labelKey);
      byKey.set(labelKey, { ...prev, ...entry, _source: "owner_request" });
      continue;
    }
    byKey.set(archetypeKey || labelKey || `owner_${byKey.size}`, {
      ...entry,
      _source: "owner_request",
    });
  }

  return deepFreeze([...byKey.values()].map((entry) => {
    const { _source, ...rest } = entry;
    return toRecommendation(rest, {
      source: _source === "owner_request" ? "owner_request" : "operating_pack",
    });
  }));
}

/**
 * Build installable employee definition payloads for heal / reconcile.
 */
export function buildPackEmployeeDefinitions(industry, { businessName = null } = {}) {
  const packEmployees = packEmployeesForIndustry(industry);
  const packIndustry = resolveOperatingIndustry({ industry }) ?? String(industry ?? "").toLowerCase();
  const pack = getOperatingPack(packIndustry);
  const subjectModule = pack?.subjectModule
    ?? (packIndustry === "sports" ? "players" : "people");
  return deepFreeze(packEmployees.map((entry) => {
    const roleKey = String(entry.roleId ?? entry.archetypeId).replace(/[^a-z0-9_]/gi, "_").slice(0, 32);
    const base = {
      employeeId: `emp_pack_${packIndustry}_${roleKey}`,
      label: entry.label,
      archetypeId: entry.archetypeId,
      roleId: entry.roleId ?? null,
      purpose: entry.purpose,
      industry: packIndustry,
      packId: pack?.packId ?? null,
      applicableModules: [
        "work",
        "digital_workforce",
        subjectModule,
      ],
      communicationPermissions: { customerFacingRequiresApproval: true },
      approvalRequirements: ["human_approval"],
      prohibitedActions: ["autonomous_customer_send"],
      readinessState: "needs_knowledge",
      connectionDependencies: entry.connectionDependencies ?? ["business_email"],
      packDefault: true,
      honestyNote: businessName
        ? `Installed with the ${pack?.label ?? packIndustry} pack for ${businessName} — editable anytime.`
        : `Installed with the ${pack?.label ?? packIndustry} pack — editable anytime.`,
    };
    const { _operatingContractMeta, ...withContract } = ensureEmployeeOperatingContract(base, {
      industry: packIndustry,
    });
    return withContract;
  }));
}

function legacyPackEmployeeId(def) {
  const roleKey = String(def.roleId ?? def.archetypeId).replace(/[^a-z0-9_]/gi, "_").slice(0, 32);
  return `emp_pack_${roleKey}`;
}

/**
 * Merge pack defaults into an existing employee list without duplicating by id/label/roleId.
 * Never mixes packs — only the resolved industry's roles are considered.
 */
export function mergePackEmployeesIntoList(existing = [], industry = null, options = {}) {
  const current = Array.isArray(existing) ? [...existing] : [];
  const packDefs = buildPackEmployeeDefinitions(industry, options);
  if (!packDefs.length) return { employees: current, added: 0 };

  const ids = new Set(current.map((e) => String(e?.employeeId ?? e?.id ?? "").trim()).filter(Boolean));
  const labels = new Set(current.map((e) => String(e?.label ?? e?.name ?? "").trim().toLowerCase()).filter(Boolean));
  const roleIds = new Set(current.map((e) => String(e?.roleId ?? "").trim()).filter(Boolean));
  const archetypes = new Set(
    current.map((e) => String(e?.archetypeId ?? "").trim()).filter(Boolean),
  );

  let added = 0;
  for (const def of packDefs) {
    const id = String(def.employeeId);
    const legacyId = legacyPackEmployeeId(def);
    const label = String(def.label).toLowerCase();
    const roleId = String(def.roleId ?? "").trim();
    const archetypeId = String(def.archetypeId ?? "").trim();
    if (
      ids.has(id)
      || ids.has(legacyId)
      || labels.has(label)
      || (roleId && roleIds.has(roleId))
      || (archetypeId && archetypes.has(archetypeId) && labels.has(label))
    ) {
      continue;
    }
    current.push(def);
    ids.add(id);
    labels.add(label);
    if (roleId) roleIds.add(roleId);
    if (archetypeId) archetypes.add(archetypeId);
    added += 1;
  }
  return { employees: current, added };
}

export { resolveOperatingIndustry };
