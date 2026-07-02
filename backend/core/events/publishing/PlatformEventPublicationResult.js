import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { PUBLISHATION_STATUS_LIST } from "./PlatformEventPublisherDefaults.js";

export function createPlatformEventPublicationResult({
  publicationId,
  eventId,
  eventType,
  publisherId,
  publishedAt,
  stored,
  dispatched,
  dispatchReport,
  status,
  errors,
  metadata,
} = {}) {
  if (!publicationId || typeof publicationId !== "string") throw new Error("PlatformEventPublicationResult: publicationId required string.");
  if (!eventId || typeof eventId !== "string") throw new Error("PlatformEventPublicationResult: eventId required string.");
  if (!eventType || typeof eventType !== "string") throw new Error("PlatformEventPublicationResult: eventType required string.");
  if (!publisherId || typeof publisherId !== "string") throw new Error("PlatformEventPublicationResult: publisherId required string.");
  if (!publishedAt || typeof publishedAt !== "string") throw new Error("PlatformEventPublicationResult: publishedAt required string.");
  if (typeof stored !== "boolean") throw new Error("PlatformEventPublicationResult: stored required boolean.");
  if (typeof dispatched !== "boolean") throw new Error("PlatformEventPublicationResult: dispatched required boolean.");

  if (!PUBLISHATION_STATUS_LIST.includes(String(status))) throw new Error(`PlatformEventPublicationResult: invalid status: ${String(status)}`);

  const report = dispatchReport ? dispatchReport : null;

  const view = {
    publicationId,
    eventId,
    eventType,
    publisherId,
    publishedAt,
    stored,
    dispatched,
    dispatchReport: report,
    status: String(status),
    errors: Array.isArray(errors) ? deepFreeze(errors.map(String)) : deepFreeze([]),
    metadata: metadata && typeof metadata === "object" && !Array.isArray(metadata) ? deepFreeze(metadata) : deepFreeze({}),
  };

  return deepFreeze(view);
}

