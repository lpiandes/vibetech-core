import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`BusinessParty: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return String(value);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export const BUSINESS_PARTY_TYPES = ["PERSON", "ORGANIZATION"];

export function createBusinessParty({
  id,
  partyType,
  displayName,
  status,
  contactMethods = [],
  externalReferences = [],
  metadata = {},
  createdAt,
  updatedAt,
} = {}) {
  requireString(id, "id");
  requireString(partyType, "partyType");
  if (!BUSINESS_PARTY_TYPES.includes(String(partyType))) fail("partyType must be PERSON or ORGANIZATION.");
  requireString(displayName, "displayName");
  requireString(status, "status");
  if (!Array.isArray(contactMethods)) fail("contactMethods must be array.");
  if (!Array.isArray(externalReferences)) fail("externalReferences must be array.");
  if (!isPlainObject(metadata)) fail("metadata must be plain object.");
  requireString(createdAt, "createdAt");
  requireString(updatedAt, "updatedAt");

  return deepFreeze({
    id: String(id),
    partyType: String(partyType),
    displayName: String(displayName),
    status: String(status),
    contactMethods: deepFreeze(contactMethods.map(String)),
    externalReferences: deepFreeze(externalReferences.map(String)),
    metadata: deepFreeze(metadata),
    createdAt: String(createdAt),
    updatedAt: String(updatedAt),
  });
}
