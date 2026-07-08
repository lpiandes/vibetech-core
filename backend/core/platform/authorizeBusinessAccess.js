import { platformStore } from "./persistence/PostgresPlatformStore.js";
import { businessRecordToActivation, isPlatformAdmin } from "./persistence/platformMappers.js";
import { permissionsForRole, hasPermission } from "./permissions/rolePermissions.js";

export class AuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "AuthorizationError";
  }
}

/**
 * Central authorization for business workspace access.
 * @param {{ userId: string, businessId: string, platformRole?: string | null, requiredPermission?: string | null }} input
 */
export async function authorizeBusinessAccess({ userId, businessId, platformRole = null, requiredPermission = null }) {
  if (!userId) {
    throw new AuthorizationError("UNAUTHENTICATED", "Sign in required.");
  }

  const business = await platformStore.getBusinessById(businessId);
  if (!business) {
    throw new AuthorizationError("NOT_FOUND", "Business not found.");
  }

  if (isPlatformAdmin({ platformRole })) {
    await platformStore.recordAuditEvent({
      actorUserId: userId,
      businessId,
      action: "platform_admin.enter_business",
      targetType: "business",
      targetId: businessId,
    });

    return {
      allowed: true,
      business,
      membership: null,
      role: "PLATFORM_ADMIN",
      permissions: permissionsForRole("OWNER"),
      activation: businessRecordToActivation(business),
      isPlatformAdmin: true,
    };
  }

  const membership = await platformStore.getMembership(userId, businessId);
  if (!membership || membership.status !== "ACTIVE") {
    throw new AuthorizationError("FORBIDDEN", "You do not have access to this business.");
  }

  const permissions = permissionsForRole(membership.role);
  if (requiredPermission && !permissions.has(requiredPermission)) {
    throw new AuthorizationError("FORBIDDEN", "You do not have permission for this action.");
  }

  return {
    allowed: true,
    business,
    membership,
    role: membership.role,
    permissions,
    activation: businessRecordToActivation(business),
    isPlatformAdmin: false,
  };
}

export async function authorizePlatformAdmin({ userId, platformRole }) {
  if (!userId || !isPlatformAdmin({ platformRole })) {
    throw new AuthorizationError("FORBIDDEN", "Platform administrator access required.");
  }
  return true;
}

export { hasPermission, permissionsForRole };
