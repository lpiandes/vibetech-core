import bcrypt from "bcryptjs";

import { platformStore } from "../persistence/platformStore.js";
import { PLATFORM_ROLES } from "../permissions/rolePermissions.js";

const SALT_ROUNDS = 12;

export async function hashPassword(password) {
  return bcrypt.hash(String(password), SALT_ROUNDS);
}

export async function verifyPassword(password, passwordHash) {
  if (!passwordHash) return false;
  return bcrypt.compare(String(password), String(passwordHash));
}

export async function authenticateUser(email, password) {
  const user = await platformStore.getUserByEmail(email);
  if (!user?.passwordHash) return null;
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;
  return user;
}

export async function bootstrapPlatformAdmin({ email, name, password }) {
  const normalizedEmail = String(email).trim().toLowerCase();
  const existing = await platformStore.getUserByEmail(normalizedEmail);
  if (existing) {
    if (existing.platformRole === PLATFORM_ROLES.PLATFORM_ADMIN) {
      return { user: existing, created: false };
    }
    throw new Error(`User ${normalizedEmail} already exists without platform admin role.`);
  }

  const passwordHash = await hashPassword(password);
  const user = await platformStore.createUser({
    email: normalizedEmail,
    name: String(name ?? "Platform Admin").trim(),
    passwordHash,
    platformRole: PLATFORM_ROLES.PLATFORM_ADMIN,
  });

  await platformStore.recordAuditEvent({
    actorUserId: user.id,
    action: "platform_admin.bootstrapped",
    targetType: "user",
    targetId: user.id,
  });

  return { user, created: true };
}
