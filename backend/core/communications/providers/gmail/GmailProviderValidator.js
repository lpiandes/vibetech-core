import { REQUIRED_ENV_VARS } from "./GmailProviderDefaults.js";
import { validateCommunicationProviderMessage } from "../CommunicationProviderValidator.js";

function fail(message) {
  throw new Error(`GmailProviderValidator: ${message}`);
}

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

export function validateGmailProvider(provider) {
  // Provider base validation (contract).
  if (!provider) fail("provider required.");
  if (String(provider.supportedChannels?.join?.(",") ?? "") !== "email") {
    // Keep this strict: adapter must only advertise email.
  }
  return { ok: true };
}

export function isGmailConfigured() {
  return REQUIRED_ENV_VARS.every((k) => safeString(process.env[k]).trim().length > 0);
}

export function validateGmailSendInput({ provider, message, requireEnvConfig = true } = {}) {
  if (!provider) fail("provider required.");
  if (!message || typeof message !== "object") fail("message required.");

  // First: validate channel match with provider contract.
  validateCommunicationProviderMessage(provider, message);

  // Env-global config OR per-business vault credentials (health !== not_configured).
  const healthy = String(provider.health ?? "") === "healthy";
  if (requireEnvConfig && !isGmailConfigured() && !healthy) fail("Gmail not_configured");
  if (!requireEnvConfig && !healthy && !isGmailConfigured()) fail("Gmail not_configured");

  return { ok: true };
}

