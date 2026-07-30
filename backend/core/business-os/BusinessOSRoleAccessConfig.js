import { MEMBERSHIP_ROLES, MEMBERSHIP_ROLE_LABELS } from "../platform/permissions/rolePermissions.js";

/**
 * Owner-editable module-visibility matrix (Team/Settings UI). This is a
 * curated subset of module ids — not every installed module — chosen to
 * match the modules an owner actually thinks about when scoping a role.
 * Visibility is enforced via `deniedModules` (a deny-list) rather than
 * `moduleVisibility` (an allow-list) so that toggling this matrix can never
 * accidentally hide industry-specific modules outside this catalog that a
 * business happens to have installed (e.g. "properties", "teams", "players").
 */
export const ROLE_ACCESS_MODULE_CATALOG = [
  { id: "home", label: "Home" },
  { id: "people", label: "People" },
  { id: "pipelines", label: "Pipelines" },
  { id: "work", label: "Work" },
  { id: "inbox", label: "Inbox" },
  { id: "calendar", label: "Calendar" },
  { id: "ads", label: "Ads" },
  { id: "knowledge", label: "Knowledge" },
  { id: "automations", label: "Automations" },
  { id: "integrations", label: "Integrations" },
  { id: "settings", label: "Settings" },
];

const MODULE_CATALOG_IDS = new Set(ROLE_ACCESS_MODULE_CATALOG.map((module) => module.id));

/** Owner always has full access — not shown/editable in the matrix. */
export const EDITABLE_MEMBERSHIP_ROLES = [
  MEMBERSHIP_ROLES.ADMIN,
  MEMBERSHIP_ROLES.MANAGER,
  MEMBERSHIP_ROLES.EMPLOYEE,
  MEMBERSHIP_ROLES.VIEWER,
  MEMBERSHIP_ROLES.CLIENT,
];

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function readRoleDefinitions(installation, specification) {
  return asArray(
    installation?.configuration?.roles
    ?? installation?.configuration?.roleDefinitions
    ?? specification?.roleDefinitions,
  );
}

/**
 * Effective per-role module-visibility matrix for the owner editor.
 * Always returns one row per editable membership role, even if the
 * installation has no explicit role definitions yet (defaults to
 * everything visible).
 * @returns {Array<{ membershipRole: string, label: string, roleId: string|null, visibleModuleIds: string[] }>}
 */
export function readRoleAccessMatrix(installation, specification = null) {
  const roleDefinitions = readRoleDefinitions(installation, specification);
  const byMembershipRole = new Map();
  for (const role of roleDefinitions) {
    const membershipRole = String(role?.membershipRole ?? "").toUpperCase();
    if (membershipRole) byMembershipRole.set(membershipRole, role);
  }

  return EDITABLE_MEMBERSHIP_ROLES.map((membershipRole) => {
    const existing = byMembershipRole.get(membershipRole) ?? null;
    const deniedModules = new Set(asArray(existing?.deniedModules).map(String));
    return {
      membershipRole,
      label: MEMBERSHIP_ROLE_LABELS[membershipRole] ?? membershipRole,
      roleId: existing?.roleId ?? null,
      visibleModuleIds: ROLE_ACCESS_MODULE_CATALOG
        .filter((module) => !deniedModules.has(module.id))
        .map((module) => module.id),
    };
  });
}

/**
 * Persist an updated module-visibility matrix for one membership role onto
 * installation.configuration.roles. Only the deny/allow state of modules
 * inside ROLE_ACCESS_MODULE_CATALOG is touched; any other role fields
 * (permissions, deniedPermissions, denials for modules outside this
 * catalog) are preserved untouched.
 */
export async function writeRoleAccessForMembershipRole({
  platformStore,
  installation,
  specification = null,
  membershipRole,
  visibleModuleIds,
  actorId = null,
}) {
  if (!platformStore || !installation) {
    throw new Error("writeRoleAccessForMembershipRole requires platformStore and installation");
  }
  const role = String(membershipRole ?? "").toUpperCase();
  if (!EDITABLE_MEMBERSHIP_ROLES.includes(role)) {
    throw new Error(`Role "${membershipRole}" is not editable.`);
  }
  const nextVisible = new Set(asArray(visibleModuleIds).map(String).filter((id) => MODULE_CATALOG_IDS.has(id)));
  const nextDeniedFromCatalog = ROLE_ACCESS_MODULE_CATALOG
    .map((module) => module.id)
    .filter((id) => !nextVisible.has(id));

  const existingRoles = readRoleDefinitions(installation, specification).map((entry) => ({ ...entry }));
  let found = false;
  const nextRoles = existingRoles.map((entry) => {
    if (String(entry?.membershipRole ?? "").toUpperCase() !== role) return entry;
    found = true;
    const preservedDenied = asArray(entry?.deniedModules)
      .map(String)
      .filter((id) => !MODULE_CATALOG_IDS.has(id));
    return {
      ...entry,
      deniedModules: [...preservedDenied, ...nextDeniedFromCatalog],
    };
  });
  if (!found) {
    nextRoles.push({
      roleId: role.toLowerCase(),
      label: MEMBERSHIP_ROLE_LABELS[role] ?? role,
      membershipRole: role,
      deniedModules: nextDeniedFromCatalog,
    });
  }

  await platformStore.upsertBusinessOSInstallation({
    id: installation.id ?? installation.installationId ?? `install_${installation.businessId}`,
    businessId: installation.businessId,
    specificationRowId: installation.specificationRowId ?? null,
    specificationId: installation.specificationId,
    specificationVersion: installation.specificationVersion ?? 1,
    specificationContentHash: installation.specificationContentHash
      ?? installation.contentHash
      ?? "role_access_update",
    planId: installation.planId ?? `plan_${installation.businessId}`,
    status: installation.status ?? "installed",
    plan: installation.plan ?? {},
    actionCheckpoints: installation.actionCheckpoints ?? [],
    configuration: {
      ...(installation.configuration && typeof installation.configuration === "object"
        ? installation.configuration
        : {}),
      roles: nextRoles,
    },
    history: [
      ...(Array.isArray(installation.history) ? installation.history : []),
      { at: new Date().toISOString(), action: "role_access_update", actorId, membershipRole: role },
    ],
    actorUserId: installation.actorUserId ?? actorId,
    installedAt: installation.installedAt ?? null,
  });

  return nextRoles;
}
