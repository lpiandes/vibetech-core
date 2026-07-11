import { businessRecordToActivation, isPlatformAdmin } from "./persistence/platformMappers.js";
import { permissionsForRole, hasPermission } from "./permissions/rolePermissions.js";
import { AuthorizationError } from "./AuthorizationError.js";

export { AuthorizationError };

/**
 * @param {{
 *   store: object,
 *   supportAccessService?: object | null,
 *   createSupportAccessService?: () => object,
 * }} deps
 */
export function createAuthorizationService({
  store,
  supportAccessService = null,
  createSupportAccessService = null,
}) {
  if (!store || typeof store.getBusinessById !== "function") {
    throw new Error("createAuthorizationService requires a platform store");
  }

  function resolveSupportService(override = null) {
    if (override) return override;
    if (supportAccessService) return supportAccessService;
    if (typeof createSupportAccessService === "function") return createSupportAccessService();
    throw new Error("createAuthorizationService requires supportAccessService or createSupportAccessService");
  }

  async function authorizeBusinessAccess({
    userId,
    businessId,
    platformRole = null,
    requiredPermission = null,
    supportAccessService: supportOverride = null,
  }) {
    if (!userId) {
      throw new AuthorizationError("UNAUTHENTICATED", "Sign in required.");
    }

    const business = await store.getBusinessById(businessId);
    if (!business) {
      throw new AuthorizationError("NOT_FOUND", "Business not found.");
    }

    if (isPlatformAdmin({ platformRole })) {
      const support = resolveSupportService(supportOverride);
      const resolved = await support.resolveAuthorization({
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

      await store.recordAuditEvent({
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

    const membership = await store.getMembership(userId, businessId);
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

  async function authorizePlatformAdmin({ userId, platformRole }) {
    if (!userId || !isPlatformAdmin({ platformRole })) {
      throw new AuthorizationError("FORBIDDEN", "Platform administrator access required.");
    }
    return true;
  }

  return {
    authorizeBusinessAccess,
    authorizePlatformAdmin,
    AuthorizationError,
    hasPermission,
    permissionsForRole,
  };
}

export { hasPermission, permissionsForRole };
