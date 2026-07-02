import { COMMUNICATION_DIRECTIONS } from "../CommunicationDirection.js";
import { COMMUNICATION_CHANNELS } from "../CommunicationChannel.js";

function fail(message) {
  throw new Error(`CommunicationProviderValidator: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

export function validateCommunicationProvider(provider) {
  if (!provider || typeof provider !== "object") fail("provider required.");

  const id = safeString(provider.id);
  const name = safeString(provider.name);
  const supportedChannels = provider.supportedChannels;
  const health = safeString(provider.health);
  const sendFn = provider.send;

  if (!id) fail("provider.id required.");
  if (!name) fail("provider.name required.");
  if (!Array.isArray(supportedChannels) || supportedChannels.length === 0) fail("provider.supportedChannels required.");
  for (const ch of supportedChannels) {
    const s = safeString(ch);
    if (!COMMUNICATION_CHANNELS.includes(s)) {
      // Keep validator strict for determinism. It must only advertise real channels.
      fail(`provider.supportedChannels includes unsupported channel: ${s}`);
    }
  }
  if (!health) fail("provider.health required.");
  if (typeof sendFn !== "function") fail("provider.send(message) must be a function.");

  return { ok: true };
}

export function validateCommunicationProviderMessage(provider, message) {
  if (!message || typeof message !== "object") fail("message required.");
  const channel = safeString(message.channel);
  if (!channel) fail("message.channel required.");

  if (!Array.isArray(provider.supportedChannels) || !provider.supportedChannels.map(safeString).includes(channel)) {
    fail(`provider does not support message.channel: ${channel}`);
  }

  return { ok: true };
}

export function validateCommunicationProviderSendResult(result) {
  if (!result || typeof result !== "object") fail("sendResult required.");
  const providerMessageId = safeString(result.providerMessageId);
  if (!providerMessageId) fail("sendResult.providerMessageId required.");

  const status = safeString(result.status);
  if (!status) fail("sendResult.status required.");

  const sentAt = result.sentAt === undefined ? null : result.sentAt;
  if (sentAt !== null && sentAt !== undefined && typeof sentAt !== "string") {
    fail("sendResult.sentAt must be string|null|undefined.");
  }

  const metadata = result.metadata;
  if (metadata !== undefined && !isPlainObject(metadata)) fail("sendResult.metadata must be plain object if provided.");

  return { ok: true };
}

