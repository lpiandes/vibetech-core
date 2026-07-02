import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`CommunicationExecutionResult: ${message}`);
}

export function createCommunicationExecutionResult({
  executionId,
  communicationMessageId,
  providerId,
  providerMessageId,
  status,
  sentAt,
  providerMetadata,
  occurredAt,
} = {}) {
  if (!executionId || typeof executionId !== "string") fail("executionId required string.");
  if (!communicationMessageId || typeof communicationMessageId !== "string") fail("communicationMessageId required.");
  if (!providerId || typeof providerId !== "string") fail("providerId required.");
  if (!providerMessageId || typeof providerMessageId !== "string") fail("providerMessageId required.");
  if (!status || typeof status !== "string") fail("status required string.");
  if (sentAt !== null && sentAt !== undefined && typeof sentAt !== "string") fail("sentAt must be string|null|undefined.");
  if (providerMetadata !== undefined && (typeof providerMetadata !== "object" || providerMetadata === null || Array.isArray(providerMetadata))) {
    fail("providerMetadata must be plain object if provided.");
  }

  const r = {
    executionId,
    communicationMessageId,
    providerId,
    providerMessageId,
    status: String(status),
    sentAt: sentAt ? String(sentAt) : null,
    providerMetadata: providerMetadata && typeof providerMetadata === "object" ? deepFreeze(providerMetadata) : deepFreeze({}),
    occurredAt: occurredAt ? String(occurredAt) : null,
  };
  return deepFreeze(r);
}

export function validateCommunicationExecutionResult(result) {
  if (!result || typeof result !== "object") fail("result required object.");
  if (!Object.isFrozen(result)) fail("result must be frozen.");
  return { ok: true };
}

