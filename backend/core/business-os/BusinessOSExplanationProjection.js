import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import {
  resolveBusinessDisplayName,
  resolveIndustryLabel,
} from "../ai-builder/businessIdentity.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Human-readable explanation of a Business OS specification.
 * Presentation only — never mutates the specification.
 */
export function explainBusinessOSSpecification(specification) {
  if (!specification || typeof specification !== "object") {
    return deepFreeze({
      title: "Invalid specification",
      summary: "No specification provided.",
      sections: [],
    });
  }

  const profile = specification.businessProfile ?? {};
  const businessName = resolveBusinessDisplayName(
    profile.businessName,
    profile.name,
    "This business",
  );
  const industry = resolveIndustryLabel(profile.industry, "general").replace(/_/g, " ");
  const modules = asArray(specification.modules);
  const employees = asArray(specification.employeeDefinitions);
  const roles = asArray(specification.roleDefinitions);
  const gaps = asArray(specification.capabilityGaps);
  const unresolved = asArray(specification.unresolvedRequirements);
  const campaigns = asArray(specification.campaignDefinitions);

  const sections = [
    {
      id: "profile",
      title: "Business profile",
      body: `${businessName} operates as a ${industry} business`
        + (profile.subIndustry ? ` (${String(profile.subIndustry).replace(/_/g, " ")})` : "")
        + ".",
    },
    {
      id: "modules",
      title: "Workspaces",
      body: modules.length
        ? `Primary workspaces: ${modules.map((module) => module.label).join(", ")}.`
        : "No modules defined yet.",
      items: modules.map((module) => ({
        id: module.moduleId,
        label: module.label,
        detail: module.description ?? module.moduleType,
      })),
    },
    {
      id: "workforce",
      title: "Digital Workforce",
      body: employees.length
        ? `${employees.length} digital employee${employees.length === 1 ? "" : "s"}: ${
          employees.map((employee) => employee.label).filter(Boolean).join(", ")
        }.`
        : "No digital employees defined yet.",
      items: employees.map((employee) => ({
        id: employee.employeeId,
        label: employee.label,
        detail: employee.purpose ?? employee.archetypeId,
      })),
    },
    {
      id: "roles",
      title: "Roles and access",
      body: roles.length
        ? `Role recipes: ${roles.map((role) => role.label ?? role.roleId).join(", ")}.`
        : "Using platform membership roles until role recipes are installed.",
      items: roles.map((role) => ({
        id: role.roleId,
        label: role.label ?? role.roleId,
        detail: asArray(role.moduleVisibility).join(", ") || asArray(role.permissions).join(", "),
      })),
    },
    {
      id: "campaigns",
      title: "Campaigns",
      body: campaigns.length
        ? `${campaigns.length} campaign template${campaigns.length === 1 ? "" : "s"} require human approval before send.`
        : "No campaign templates in this specification.",
    },
    {
      id: "gaps",
      title: "Capability gaps",
      body: gaps.length || unresolved.length
        ? "Some needs are deferred or unresolved and will not pretend to work."
        : "No open capability gaps recorded.",
      items: [
        ...gaps.map((gap) => ({
          id: gap.capabilityId ?? gap.id,
          label: gap.label ?? gap.capabilityId ?? gap.id,
          detail: gap.reason ?? "Deferred or unsupported",
        })),
        ...unresolved.map((entry) => ({
          id: entry.id ?? entry.requirementId,
          label: entry.question ?? entry.label ?? String(entry.id),
          detail: "Unresolved requirement",
        })),
      ],
    },
  ];

  return deepFreeze({
    title: specification.terminology?.operatingSystemTitle
      ?? `${businessName} Operating System`,
    summary: `${businessName} will run on VIBETech with ${modules.length} workspace${modules.length === 1 ? "" : "s"}`
      + `, ${employees.length} digital employee${employees.length === 1 ? "" : "s"}`
      + `, and governed installation — never silent setup.`,
    status: specification.status,
    version: specification.version ?? specification.specificationVersion,
    contentHash: specification.contentHash ?? null,
    sections,
  });
}
