import { permissionsForRole, hasPermission, isNavAllowed, PERMISSIONS } from "../../../backend/core/platform/permissions/rolePermissions.js";

export { permissionsForRole, hasPermission, isNavAllowed, PERMISSIONS };

export function canUsePermission(permissions: Set<string>, permission: string) {
  return permissions.has(permission);
}
