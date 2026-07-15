export const PLATFORM_ROLES = {
  PLATFORM_ADMIN: "PLATFORM_ADMIN",
};

export const MEMBERSHIP_ROLES = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  MANAGER: "MANAGER",
  EMPLOYEE: "EMPLOYEE",
  VIEWER: "VIEWER",
};

export const MEMBERSHIP_ROLE_LABELS = {
  OWNER: "Owner",
  ADMIN: "Administrator",
  MANAGER: "Manager",
  EMPLOYEE: "Team member",
  VIEWER: "View only",
};

export const BUSINESS_KINDS = {
  NORMAL: "NORMAL",
  DEMO: "DEMO",
};

export const INVITATION_TTL_DAYS = 7;

export const PERMISSIONS = {
  BUSINESS_MANAGE: "business.manage",
  TEAM_INVITE: "team.invite",
  TEAM_MANAGE: "team.manage",
  INTEGRATIONS_MANAGE: "integrations.manage",
  KNOWLEDGE_MANAGE: "knowledge.manage",
  WORK_VIEW: "work.view",
  WORK_MANAGE: "work.manage",
  INBOX_VIEW: "inbox.view",
  INBOX_MANAGE: "inbox.manage",
  APPROVALS_DECIDE: "approvals.decide",
  SETTINGS_MANAGE: "settings.manage",
  PEOPLE_VIEW: "people.view",
  PERFORMANCE_VIEW: "performance.view",
};

const ROLE_PERMISSIONS = {
  OWNER: Object.values(PERMISSIONS),
  ADMIN: [
    PERMISSIONS.TEAM_INVITE,
    PERMISSIONS.TEAM_MANAGE,
    PERMISSIONS.INTEGRATIONS_MANAGE,
    PERMISSIONS.KNOWLEDGE_MANAGE,
    PERMISSIONS.WORK_VIEW,
    PERMISSIONS.WORK_MANAGE,
    PERMISSIONS.INBOX_VIEW,
    PERMISSIONS.INBOX_MANAGE,
    PERMISSIONS.APPROVALS_DECIDE,
    PERMISSIONS.SETTINGS_MANAGE,
    PERMISSIONS.PEOPLE_VIEW,
    PERMISSIONS.PERFORMANCE_VIEW,
  ],
  MANAGER: [
    PERMISSIONS.TEAM_INVITE,
    PERMISSIONS.KNOWLEDGE_MANAGE,
    PERMISSIONS.WORK_VIEW,
    PERMISSIONS.WORK_MANAGE,
    PERMISSIONS.INBOX_VIEW,
    PERMISSIONS.INBOX_MANAGE,
    PERMISSIONS.APPROVALS_DECIDE,
    PERMISSIONS.PEOPLE_VIEW,
    PERMISSIONS.PERFORMANCE_VIEW,
  ],
  EMPLOYEE: [
    PERMISSIONS.WORK_VIEW,
    PERMISSIONS.INBOX_VIEW,
    PERMISSIONS.PEOPLE_VIEW,
  ],
  VIEWER: [
    PERMISSIONS.WORK_VIEW,
    PERMISSIONS.INBOX_VIEW,
    PERMISSIONS.PEOPLE_VIEW,
    PERMISSIONS.PERFORMANCE_VIEW,
  ],
};

export function permissionsForRole(role) {
  return new Set(ROLE_PERMISSIONS[String(role)] ?? []);
}

export function hasPermission(role, permission) {
  return permissionsForRole(role).has(permission);
}

export function canInviteRole(inviterRole, targetRole) {
  const inviter = String(inviterRole);
  const target = String(targetRole);
  if (target === MEMBERSHIP_ROLES.OWNER) return inviter === MEMBERSHIP_ROLES.OWNER;
  if (!hasPermission(inviter, PERMISSIONS.TEAM_INVITE)) return false;
  if (target === MEMBERSHIP_ROLES.ADMIN) {
    return inviter === MEMBERSHIP_ROLES.OWNER || inviter === MEMBERSHIP_ROLES.ADMIN;
  }
  return true;
}

export const NAV_PERMISSIONS = {
  home: null,
  "for-you": PERMISSIONS.WORK_VIEW,
  work: PERMISSIONS.WORK_VIEW,
  people: PERMISSIONS.PEOPLE_VIEW,
  inbox: PERMISSIONS.INBOX_VIEW,
  team: PERMISSIONS.TEAM_MANAGE,
  knowledge: PERMISSIONS.KNOWLEDGE_MANAGE,
  performance: PERMISSIONS.PERFORMANCE_VIEW,
  integrations: PERMISSIONS.INTEGRATIONS_MANAGE,
  settings: PERMISSIONS.SETTINGS_MANAGE,
};

export function isNavAllowed(navKey, role) {
  if (navKey === "team") {
    return hasPermission(role, PERMISSIONS.TEAM_INVITE) || hasPermission(role, PERMISSIONS.TEAM_MANAGE);
  }
  const required = NAV_PERMISSIONS[navKey];
  if (!required) return true;
  return hasPermission(role, required);
}
