import { platformStore } from "./persistence/PostgresPlatformStore.js";
import { businessRecordToActivation, isPlatformAdmin } from "./persistence/platformMappers.js";
import { permissionsForRole, hasPermission } from "./permissions/rolePermissions.js";
import {
  getDefaultSupportAccessService,
} from "./support/SupportAccessService.js";

export class AuthorizationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = "AuthorizationError";
  }
}

/**
 * Central authorization for business workspace access.
 * Platform admins require explicit support access with reason — never silent ownership.
 * @param {{ userId: string, businessId: string, platformRole?: string | null, requiredPermission?: string | null, supportAccessService?: object | null }} input
 */
export async function authorizeBusinessAccess({
  userId,
  businessId,
  platformRole = null,
  requiredPermission = null,
  supportAccessService = null,
}) {
  if (!userId) {
    throw new AuthorizationError("UNAUTHENTICATED", "Sign in required.");
  }

  const business = await platformStore.getBusinessById(businessId);
  if (!business) {
    throw new AuthorizationError("NOT_FOUND", "Business not found.");
  }

  if (isPlatformAdmin({ platformRole })) {
    const support = supportAccessService ?? getDefaultSupportAccessService();
    const resolved = support.resolveAuthorization({
      adminUserId: userId,
      platformRole,
      businessId,
    });
    if (!resolved.ok) {
      throw new AuthorizationError(
        "SUPPORT_ACCESS_REQUIRED",
        "VIBETech support access with a reason is required before entering a client business.",
      );
    }

    await platformStore.recordAuditEvent({
      actorUserId: userId,
      businessId,
      action: "platform_admin.enter_business",
      targetType: "business",
      targetId: businessId,
      metadata: {
        supportSessionId: resolved.session.sessionId,
        mode: resolved.session.mode,
        reason: resolved.session.reason,
        permanentMembership: false,
      },
    });

    return {
      allowed: true,
      business,
      membership: null,
      role: "PLATFORM_ADMIN",
      permissions: resolved.permissions,
      activation: businessRecordToActivation(business),
      isPlatformAdmin: true,
      supportAccess: resolved.supportAccess,
      actorUserId: userId,
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
    supportAccess: null,
    actorUserId: userId,
  };
}

export async function authorizePlatformAdmin({ userId, platformRole }) {
  if (!userId || !isPlatformAdmin({ platformRole })) {
    throw new AuthorizationError("FORBIDDEN", "Platform administrator access required.");
  }
  return true;
}

export { hasPermission, permissionsForRole };
