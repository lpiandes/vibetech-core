import {
  COMMUNICATION_CHANNELS,
  COMMUNICATION_STATUSES,
} from "./CommunicationTypes.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const key of Object.keys(value)) {
    deepFreeze(value[key]);
  }
  return Object.freeze(value);
}

function requireString(value, name) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Communication: expected ${name} to be a non-empty string.`);
  }
}

function requireISO(value, name) {
  if (typeof value !== "string") {
    throw new Error(`Communication: expected ${name} to be an ISO string.`);
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Communication: expected ${name} to be a valid ISO string.`);
  }
}

/**
 * @param {object} input
 * @param {string} input.communicationId
 * @param {string} input.channel
 * @param {string} input.status
 * @param {string} input.subject
 * @param {string} input.body
 * @param {string} input.recipient
 * @param {string} input.createdAt
 * @param {boolean} input.reviewRequired
 */
export function createCommunication(input) {
  const {
    communicationId,
    channel,
    status,
    subject,
    body,
    recipient,
    createdAt,
    sentAt,
    openedAt,
    repliedAt,
    approvedBy,
    reviewRequired,
    timeline,
  } = input ?? {};

  requireString(communicationId, "communicationId");
  requireString(subject, "subject");
  requireString(body, "body");
  requireString(recipient, "recipient");
  requireISO(createdAt, "createdAt");

  const allowedStatuses = Object.values(COMMUNICATION_STATUSES);
  if (!allowedStatuses.includes(status)) {
    throw new Error(`Communication: invalid status: ${status}`);
  }

  const allowedChannels = Object.values(COMMUNICATION_CHANNELS);
  if (!allowedChannels.includes(channel)) {
    throw new Error(`Communication: invalid channel: ${channel}`);
  }

  const hasSentAt = typeof sentAt === "string";
  if (hasSentAt) requireISO(sentAt, "sentAt");
  const hasOpenedAt = typeof openedAt === "string";
  if (hasOpenedAt) requireISO(openedAt, "openedAt");
  const hasRepliedAt = typeof repliedAt === "string";
  if (hasRepliedAt) requireISO(repliedAt, "repliedAt");

  const next = {
    communicationId,
    channel,
    status,
    subject,
    body,
    recipient,
    createdAt,
    sentAt,
    openedAt,
    repliedAt,
    approvedBy,
    reviewRequired,
    timeline: Array.isArray(timeline) ? timeline : [],
  };

  return deepFreeze(next);
}

