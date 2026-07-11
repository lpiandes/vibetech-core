import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { permissionsForRole } from "../platform/permissions/rolePermissions.js";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

/**
 * Resolves module and permission visibility from specification role recipes
 * layered on platform membership roles — does not replace memberships.
 */
export function resolveRoleAccess({
  specification = null,
  configuration = null,
  membershipRole = "EMPLOYEE",
  roleId = null,
  permissions = null,
} = {}) {
  const roleDefinitions = asArray(
    configuration?.roles
    ?? configuration?.roleDefinitions
    ?? specification?.roleDefinitions,
  );

  const matched = roleId
    ? roleDefinitions.find((role) => role.roleId === roleId)
    : roleDefinitions.find((role) => String(role.membershipRole) === String(membershipRole))
      ?? null;

  const platformPermissions = permissions instanceof Set
    ? permissions
    : new Set(Array.isArray(permissions) ? permissions : [...permissionsForRole(membershipRole)]);

  const modules = asArray(configuration?.modules ?? specification?.modules);
  const deniedModules = new Set(asArray(matched?.deniedModules).map(String));
  const allowedModules = matched?.moduleVisibility
    ? new Set(asArray(matched.moduleVisibility).map(String))
    : null;

  const visibleModules = modules.filter((module) => {
    const moduleId = String(module.moduleId);
    if (deniedModules.has(moduleId)) return false;
    if (allowedModules && !allowedModules.has(moduleId)) return false;

    const roleVisibility = asArray(module.roleVisibility);
    if (roleVisibility.length === 0) return true;
    return roleVisibility.some((permission) => platformPermissions.has(permission));
  });

  const deniedPermissions = new Set(asArray(matched?.deniedPermissions).map(String));
  const effectivePermissions = new Set(
    [...platformPermissions].filter((permission) => !deniedPermissions.has(permission)),
  );

  if (matched?.permissions?.includes("*")) {
    for (const permission of platformPermissions) effectivePermissions.add(permission);
  } else if (matched?.permissions) {
    for (const permission of asArray(matched.permissions)) {
      if (permission !== "*") effectivePermissions.add(permission);
    }
  }

  return deepFreeze({
    membershipRole: String(membershipRole),
    roleId: matched?.roleId ?? null,
    roleLabel: matched?.label ?? null,
    visibleModuleIds: visibleModules.map((module) => module.moduleId),
    deniedModuleIds: [...deniedModules],
    permissions: [...effectivePermissions],
    canRequestAccess: asArray(specification?.accessRequestPolicies ?? configuration?.accessRequestPolicies).length > 0,
    ownerProtected: String(membershipRole) === "OWNER",
  });
}

export function canAccessModule({ roleAccess, moduleId }) {
  return asArray(roleAccess?.visibleModuleIds).includes(String(moduleId));
}
