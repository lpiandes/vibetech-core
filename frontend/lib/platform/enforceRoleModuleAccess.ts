/**
 * Server-side enforcement companion to `RoleAccessPanel` / `BusinessOSRoleAccessConfig`.
 * The primary nav already hides denied modules (see canonicalBusinessNavigation.ts),
 * but a teammate can still deep-link straight to a denied module's URL — this
 * redirects them to Home instead of rendering the page.
 */
import { redirect } from "next/navigation";

import { platformStore } from "@/lib/server/compose";
import { resolveRoleAccess as resolveRoleAccessRaw } from "../../../backend/core/business-os/BusinessOSRoleAccess.js";

const resolveRoleAccess = resolveRoleAccessRaw as (input: Record<string, unknown>) => {
  deniedModuleIds: string[];
};

/** Owner and platform admin can never be locked out — deny lists are not editable for those roles. */
function isUnrestrictedRole(role: string) {
  return role === "OWNER" || role === "PLATFORM_ADMIN";
}

export async function isModuleDeniedForRole({
  businessId,
  role,
  moduleId,
  installation,
}: {
  businessId: string;
  role: string;
  moduleId: string;
  installation?: { configuration?: { roles?: unknown; roleDefinitions?: unknown } | null } | null;
}): Promise<boolean> {
  if (isUnrestrictedRole(role)) return false;
  const install = installation !== undefined
    ? installation
    : await platformStore.getBusinessOSInstallation(businessId).catch(() => null);
  const roleDefinitions = install?.configuration?.roles ?? install?.configuration?.roleDefinitions ?? [];
  const { deniedModuleIds } = resolveRoleAccess({
    configuration: { roles: roleDefinitions },
    membershipRole: role,
    permissions: [],
  });
  return deniedModuleIds.includes(moduleId);
}

/**
 * Redirects to Home when the current membership role has denied this module
 * in Team → Role access. Call right after `getAuthorizedWorkspace` on any
 * page whose route segment matches a `ROLE_ACCESS_MODULE_CATALOG` id.
 */
export async function redirectIfModuleDenied({
  businessId,
  role,
  moduleId,
  installation,
}: {
  businessId: string;
  role: string;
  moduleId: string;
  installation?: { configuration?: { roles?: unknown; roleDefinitions?: unknown } | null } | null;
}): Promise<void> {
  const denied = await isModuleDeniedForRole({ businessId, role, moduleId, installation });
  if (denied) {
    redirect(`/b/${encodeURIComponent(businessId)}/home`);
  }
}
