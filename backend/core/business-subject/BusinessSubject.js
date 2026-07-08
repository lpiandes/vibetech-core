import { deepFreeze } from "../workspace/_utils/deepFreeze.js";
import { BUSINESS_SUBJECT_STATUSES } from "./BusinessSubjectEventTypes.js";

function fail(message) {
  throw new Error(`BusinessSubject: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return String(v);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function createBusinessSubject({
  id,
  workspaceId,
  subjectType,
  displayName,
  status = "active",
  keyAttributes = {},
  externalReferences = [],
  createdAt,
  updatedAt,
} = {}) {
  requireString(id, "id");
  requireString(workspaceId, "workspaceId");
  requireString(subjectType, "subjectType");
  requireString(displayName, "displayName");
  requireString(createdAt, "createdAt");
  requireString(updatedAt, "updatedAt");

  const st = String(status);
  if (!BUSINESS_SUBJECT_STATUSES.includes(st)) fail(`invalid status: ${st}`);

  if (!isPlainObject(keyAttributes)) fail("keyAttributes must be plain object.");

  return deepFreeze({
    id: String(id),
    workspaceId: String(workspaceId),
    subjectType: String(subjectType),
    displayName: String(displayName),
    status: st,
    keyAttributes: deepFreeze({ ...keyAttributes }),
    externalReferences: deepFreeze(
      Array.isArray(externalReferences) ? externalReferences.map(String) : [],
    ),
    createdAt: String(createdAt),
    updatedAt: String(updatedAt),
  });
}
