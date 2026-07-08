import crypto from "node:crypto";

import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { PLATFORM_ROLES } from "../permissions/rolePermissions.js";

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function generateInvitationToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function mapUserRow(row) {
  if (!row) return null;
  return deepFreeze({
    id: String(row.id),
    email: String(row.email),
    name: String(row.name ?? ""),
    platformRole: row.platform_role ?? null,
    passwordHash: row.password_hash ?? null,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  });
}

export function mapBusinessRow(row) {
  if (!row) return null;
  return deepFreeze({
    id: String(row.id),
    workspaceId: String(row.id),
    name: String(row.name),
    kind: String(row.kind),
    industryPackageId: row.industry_package_id ?? null,
    industryPackageVersion: Number(row.industry_package_version ?? 1),
    demoConfigurationId: row.demo_configuration_id ?? null,
    packageConfiguration: row.package_configuration ?? {},
    status: String(row.status ?? "ACTIVE"),
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  });
}

export function mapMembershipRow(row) {
  if (!row) return null;
  return deepFreeze({
    id: String(row.id),
    userId: String(row.user_id),
    businessId: String(row.business_id),
    role: String(row.role),
    status: String(row.status),
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
    updatedAt: row.updated_at?.toISOString?.() ?? row.updated_at,
  });
}

export function mapInvitationRow(row) {
  if (!row) return null;
  return deepFreeze({
    id: String(row.id),
    businessId: String(row.business_id),
    email: String(row.email),
    role: String(row.role),
    invitedByUserId: row.invited_by_user_id ? String(row.invited_by_user_id) : null,
    tokenHash: String(row.token_hash),
    expiresAt: row.expires_at?.toISOString?.() ?? row.expires_at,
    acceptedAt: row.accepted_at?.toISOString?.() ?? row.accepted_at ?? null,
    revokedAt: row.revoked_at?.toISOString?.() ?? row.revoked_at ?? null,
    createdAt: row.created_at?.toISOString?.() ?? row.created_at,
  });
}

export function isPlatformAdmin(user) {
  return String(user?.platformRole ?? "") === PLATFORM_ROLES.PLATFORM_ADMIN;
}

export function businessRecordToActivation(record) {
  if (!record) return {};
  return {
    workspaceId: record.id,
    companyId: record.id,
    industryPackageId: record.industryPackageId ?? null,
    industryPackageVersion: record.industryPackageVersion ?? null,
    demoConfigurationId: record.demoConfigurationId ?? null,
    packageConfiguration: record.packageConfiguration ?? {},
    businessKind: record.kind ?? "NORMAL",
    activatedAt: record.createdAt ?? null,
  };
}
