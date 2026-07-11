import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { permissionsForRole } from "../permissions/rolePermissions.js";

export const SUPPORT_ACCESS_MODES = Object.freeze(["read_only", "elevated"]);

/**
 * Explicit, time-bounded VIBETech platform-admin support access session.
 * Never creates permanent membership unless separately granted.
 */
export function createSupportAccessSession({
  sessionId,
  businessId,
  adminUserId,
  reason,
  mode = "read_only",
  startedAt = new Date().toISOString(),
  expiresAt = null,
  endedAt = null,
  status = "active",
  actorIdentity = null,
  metadata = {},
} = {}) {
  if (!sessionId) throw new Error("SupportAccessSession: sessionId required.");
  if (!businessId) throw new Error("SupportAccessSession: businessId required.");
  if (!adminUserId) throw new Error("SupportAccessSession: adminUserId required.");
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    throw new Error("SupportAccessSession: reason required.");
  }
  if (!SUPPORT_ACCESS_MODES.includes(String(mode))) {
    throw new Error(`SupportAccessSession: unsupported mode: ${mode}`);
  }

  return deepFreeze({
    sessionId: String(sessionId),
    businessId: String(businessId),
    adminUserId: String(adminUserId),
    reason: String(reason).trim(),
    mode: String(mode),
    startedAt: String(startedAt),
    expiresAt: expiresAt == null ? null : String(expiresAt),
    endedAt: endedAt == null ? null : String(endedAt),
    status: String(status),
    actorIdentity: deepFreeze({
      userId: String(adminUserId),
      platformRole: "PLATFORM_ADMIN",
      ...(actorIdentity && typeof actorIdentity === "object" ? actorIdentity : {}),
    }),
    permanentMembershipGranted: false,
    metadata: deepFreeze(metadata && typeof metadata === "object" ? { ...metadata } : {}),
  });
}

export function permissionsForSupportMode(mode) {
  if (String(mode) === "elevated") {
    return permissionsForRole("OWNER");
  }
  // read_only: view-oriented permissions only
  return new Set([
    "work.view",
    "inbox.view",
    "people.view",
    "performance.view",
  ]);
}
