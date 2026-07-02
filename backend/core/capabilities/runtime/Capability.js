import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { normalizeCapabilityLevel } from "./CapabilityLevel.js";
import { createCapabilityCategory } from "./CapabilityCategory.js";
import { createCapabilityRequirement } from "./CapabilityRequirement.js";

const SUPPORTED_CAPABILITY_STATUSES = ["active", "archived"];
const SUPPORTED_PROVIDER_TYPES = ["human", "digital_employee", "automation", "external_system"];

function fail(message) {
  throw new Error(`Capability: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function normalizeProviders(providedBy) {
  const list = Array.isArray(providedBy) ? providedBy : [];
  if (list.length === 0) return deepFreeze([]);
  const normalized = list.map((p) => {
    const s = requireString(p, "providedBy entry");
    if (!SUPPORTED_PROVIDER_TYPES.includes(String(s))) fail(`unsupported provider type: ${String(s)}`);
    return String(s);
  });
  return deepFreeze(normalized);
}

export function createCapability({ id, name, description, category, level, status, requirements, providedBy, requiredKnowledge, requiredConnectedSystems, metadata } = {}) {
  requireString(id, "id");
  requireString(name, "name");
  requireString(description, "description");
  requireString(category, "category");

  const normalizedLevel = normalizeCapabilityLevel(level);

  const st = String(status ?? "active");
  if (!SUPPORTED_CAPABILITY_STATUSES.includes(st)) fail(`invalid status: ${st}`);

  const reqs = Array.isArray(requirements) ? requirements.map((r) => createCapabilityRequirement(r)) : [];
  const providers = normalizeProviders(providedBy);
  const reqKnowledge = Array.isArray(requiredKnowledge) ? requiredKnowledge.map((x) => requireString(x, "requiredKnowledge entry")) : [];
  const reqSystems = Array.isArray(requiredConnectedSystems) ? requiredConnectedSystems.map((x) => requireString(x, "requiredConnectedSystems entry")) : [];

  const md = metadata && isPlainObject(metadata) ? deepFreeze(metadata) : deepFreeze({});

  // Category is stored by id for compactness; category objects live in runtime categories.
  return deepFreeze({
    id: String(id),
    name: String(name),
    description: String(description),
    category: String(category),
    level: normalizedLevel,
    status: st,
    requirements: deepFreeze(reqs),
    providedBy: providers,
    requiredKnowledge: deepFreeze(reqKnowledge),
    requiredConnectedSystems: deepFreeze(reqSystems),
    metadata: md,
  });
}

export { SUPPORTED_PROVIDER_TYPES, SUPPORTED_CAPABILITY_STATUSES };

