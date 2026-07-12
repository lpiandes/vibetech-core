import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { randomUUID } from "node:crypto";

export function createBuilderChangeRequest({
  changeRequestId = `bcr_${randomUUID().slice(0, 10)}`,
  sessionId,
  businessId = null,
  text,
  interpreted = null,
  capabilityId = null,
  createdAt = new Date().toISOString(),
} = {}) {
  if (!sessionId) throw new Error("BuilderChangeRequest: sessionId required.");
  if (!text) throw new Error("BuilderChangeRequest: text required.");
  return deepFreeze({
    changeRequestId: String(changeRequestId),
    sessionId: String(sessionId),
    businessId: businessId == null ? null : String(businessId),
    text: String(text),
    capabilityId: capabilityId
      ?? interpreted?.capabilityId
      ?? null,
    interpreted: interpreted == null ? null : deepFreeze(interpreted),
    createdAt: String(createdAt),
  });
}
