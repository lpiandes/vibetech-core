import { MEMBERSHIP_ROLES } from "../platform/permissions/rolePermissions.js";

const ROLE_RANK = {
  [MEMBERSHIP_ROLES.VIEWER]: 1,
  [MEMBERSHIP_ROLES.EMPLOYEE]: 2,
  [MEMBERSHIP_ROLES.MANAGER]: 3,
  [MEMBERSHIP_ROLES.ADMIN]: 4,
  [MEMBERSHIP_ROLES.OWNER]: 5,
};

const MODULE_ROLE_FLOOR = {
  performance: MEMBERSHIP_ROLES.MANAGER,
  intelligence: MEMBERSHIP_ROLES.MANAGER,
  integrations: MEMBERSHIP_ROLES.ADMIN,
  team: MEMBERSHIP_ROLES.MANAGER,
  settings: MEMBERSHIP_ROLES.ADMIN,
  campaigns: MEMBERSHIP_ROLES.MANAGER,
  work: MEMBERSHIP_ROLES.EMPLOYEE,
};

/**
 * Apply an approved access-request grant using existing membership APIs only.
 */
export async function applyAccessRequestMembershipGrant(platformStore, grant) {
  if (!grant?.userId || !grant?.businessId) return null;

  const membership = await platformStore.getMembership(grant.userId, grant.businessId);
  if (!membership || membership.status !== "ACTIVE") {
    return { ok: false, reason: "membership_required" };
  }

  let nextRole = membership.role;

  if (grant.roleId) {
    const requested = normalizeRole(grant.roleId);
    if (requested && ROLE_RANK[requested] > ROLE_RANK[nextRole]) {
      nextRole = requested;
    }
  }

  if (grant.moduleId) {
    const floor = MODULE_ROLE_FLOOR[String(grant.moduleId).toLowerCase()];
    if (floor && ROLE_RANK[floor] > ROLE_RANK[nextRole]) {
      nextRole = floor;
    }
  }

  if (grant.permission === "performance.view" && ROLE_RANK[MEMBERSHIP_ROLES.MANAGER] > ROLE_RANK[nextRole]) {
    nextRole = MEMBERSHIP_ROLES.MANAGER;
  }

  if (nextRole !== membership.role) {
    if (nextRole === MEMBERSHIP_ROLES.OWNER) {
      return { ok: false, reason: "owner_escalation_requires_owner" };
    }
    await platformStore.createMembership({
      userId: grant.userId,
      businessId: grant.businessId,
      role: nextRole,
      status: "ACTIVE",
    });
  }

  await platformStore.recordAuditEvent({
    actorUserId: grant.approverUserId ?? null,
    businessId: grant.businessId,
    action: "access_request.membership_applied",
    targetType: "user",
    targetId: grant.userId,
    metadata: {
      previousRole: membership.role,
      nextRole,
      moduleId: grant.moduleId ?? null,
      permission: grant.permission ?? null,
      accessRequestId: grant.accessRequestId ?? null,
    },
  });

  return { ok: true, previousRole: membership.role, nextRole };
}

function normalizeRole(roleId) {
  const raw = String(roleId ?? "").trim().toUpperCase();
  if (Object.values(MEMBERSHIP_ROLES).includes(raw)) return raw;
  const map = {
    manager: MEMBERSHIP_ROLES.MANAGER,
    admin: MEMBERSHIP_ROLES.ADMIN,
    employee: MEMBERSHIP_ROLES.EMPLOYEE,
    viewer: MEMBERSHIP_ROLES.VIEWER,
    owner: MEMBERSHIP_ROLES.OWNER,
  };
  return map[String(roleId ?? "").trim().toLowerCase()] ?? null;
}
