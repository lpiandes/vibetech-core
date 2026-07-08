import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export const ENTITY_TYPES = {
  PARTY: "Party",
  REQUEST: "Request",
  WORK: "Work",
  SUBJECT: "Subject",
  INTERACTION: "Interaction",
  COMMUNICATION_THREAD: "CommunicationThread",
  COMMUNICATION_MESSAGE: "CommunicationMessage",
  AUTOMATION_RUN: "AutomationRun",
  APPROVAL: "Approval",
  ORGANIZATION: "Organization",
};

function fail(message) {
  throw new Error(`EntityRef: ${message}`);
}

export function createEntityRef({ entityType, entityId } = {}) {
  if (!entityType || typeof entityType !== "string") fail("entityType required string.");
  if (!entityId || typeof entityId !== "string") fail("entityId required string.");
  return deepFreeze({ entityType: String(entityType), entityId: String(entityId) });
}

export function isEntityRef(value) {
  return Boolean(value) && typeof value === "object" && typeof value.entityType === "string" && typeof value.entityId === "string";
}
