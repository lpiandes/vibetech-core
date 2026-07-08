import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const DEV_MAILBOX_PATH = path.join(repoRoot, ".dev", "dev-invitations.json");

function isDevEnvironment() {
  return process.env.NODE_ENV !== "production";
}

function ensureStoreDir() {
  const dir = path.dirname(DEV_MAILBOX_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function readStore() {
  if (!isDevEnvironment()) return {};
  try {
    if (!fs.existsSync(DEV_MAILBOX_PATH)) return {};
    const parsed = JSON.parse(fs.readFileSync(DEV_MAILBOX_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  if (!isDevEnvironment()) return;
  ensureStoreDir();
  fs.writeFileSync(DEV_MAILBOX_PATH, JSON.stringify(store, null, 2));
}

/**
 * Dev-only: persist invitation URLs locally. Raw tokens never go to PostgreSQL.
 */
export function recordDevInvitation({
  invitationId,
  businessId,
  email,
  businessName,
  inviteUrl,
  role,
  expiresAt,
}) {
  if (!isDevEnvironment()) return;
  const store = readStore();
  store[String(invitationId)] = {
    invitationId: String(invitationId),
    businessId: String(businessId),
    email: String(email),
    businessName: String(businessName),
    inviteUrl: String(inviteUrl),
    role: String(role),
    expiresAt: expiresAt ?? null,
    recordedAt: new Date().toISOString(),
  };
  writeStore(store);
}

export function listDevInvitationLinks() {
  if (!isDevEnvironment()) return {};
  return readStore();
}

export function getDevInvitationLink(invitationId) {
  if (!isDevEnvironment()) return null;
  return readStore()[String(invitationId)]?.inviteUrl ?? null;
}

export function removeDevInvitationLink(invitationId) {
  if (!isDevEnvironment()) return;
  const store = readStore();
  delete store[String(invitationId)];
  writeStore(store);
}
