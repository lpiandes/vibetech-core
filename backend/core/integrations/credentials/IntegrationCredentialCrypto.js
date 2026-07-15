import crypto from "node:crypto";

function deriveKey(secret) {
  return crypto.createHash("sha256").update(String(secret)).digest();
}

function encryptionSecret() {
  return process.env.INTEGRATION_CREDENTIAL_ENCRYPTION_KEY
    ?? process.env.INVITATION_DELIVERY_ENCRYPTION_KEY
    ?? process.env.AUTH_SECRET
    ?? "";
}

export function encryptIntegrationSecrets(secrets) {
  const secret = encryptionSecret();
  if (!secret) {
    throw new Error("INTEGRATION_CREDENTIAL_ENCRYPTION_KEY_OR_AUTH_SECRET_REQUIRED");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", deriveKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(secrets ?? {}), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptIntegrationSecrets(ciphertext) {
  const secret = encryptionSecret();
  if (!secret) {
    throw new Error("INTEGRATION_CREDENTIAL_ENCRYPTION_KEY_OR_AUTH_SECRET_REQUIRED");
  }
  const buf = Buffer.from(String(ciphertext), "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", deriveKey(secret), iv);
  decipher.setAuthTag(tag);
  const json = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  return JSON.parse(json);
}
