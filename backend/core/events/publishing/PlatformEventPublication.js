import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export function createPlatformEventPublication({ publicationId, eventId, eventType, publisherId, nowISO, stored, dispatched, status, errors, metadata } = {}) {
  const base = {
    publicationId: String(publicationId ?? ""),
    eventId: String(eventId ?? ""),
    eventType: String(eventType ?? ""),
    publisherId: String(publisherId ?? ""),
    publishedAt: String(nowISO ?? ""),
    stored: Boolean(stored),
    dispatched: Boolean(dispatched),
    status: String(status ?? ""),
    errors: Array.isArray(errors) ? deepFreeze(errors.map(String)) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  };
  return deepFreeze(base);
}

