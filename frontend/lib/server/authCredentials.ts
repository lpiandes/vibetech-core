/**
 * Frontend server adapter for credential authentication.
 * Keeps bcryptjs/pg resolution inside the Next.js project root.
 * Business rules match backend AuthCredentialService.authenticateUser / hash / verify.
 */
import bcrypt from "bcryptjs";

import { withClient } from "@/lib/server/db";

const SALT_ROUNDS = 12;

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  platformRole: string | null;
  passwordHash?: string | null;
};

export async function hashPassword(password: string) {
  return bcrypt.hash(String(password), SALT_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string | null | undefined) {
  if (!passwordHash) return false;
  return bcrypt.compare(String(password), String(passwordHash));
}

export async function authenticateUser(email: string, password: string): Promise<AuthenticatedUser | null> {
  const normalizedEmail = String(email).trim().toLowerCase();
  const row = await withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT id, email, name, password_hash, platform_role
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [normalizedEmail],
    );
    return rows[0] ?? null;
  });

  if (!row?.password_hash) return null;
  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) return null;

  return {
    id: String(row.id),
    email: String(row.email),
    name: String(row.name ?? ""),
    platformRole: row.platform_role ?? null,
    passwordHash: row.password_hash ?? null,
  };
}
