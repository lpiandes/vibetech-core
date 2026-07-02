import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { createCapability } from "./Capability.js";

import { createCapabilityCategory } from "./CapabilityCategory.js";

const DEFAULT_CATEGORY_DEFS = [
  { id: "communication", name: "Communication" },
  { id: "document_processing", name: "Document Processing" },
  { id: "analysis", name: "Analysis" },
  { id: "review", name: "Review" },
  { id: "approval", name: "Approval" },
  { id: "scheduling", name: "Scheduling" },
  { id: "knowledge", name: "Knowledge" },
  { id: "customer_service", name: "Customer Service" },
  { id: "operations", name: "Operations" },
  { id: "finance", name: "Finance" },
  { id: "compliance", name: "Compliance" },
  { id: "automation", name: "Automation" },
  { id: "reporting", name: "Reporting" },
];

function buildDefaultCategories() {
  return DEFAULT_CATEGORY_DEFS.map((c) => createCapabilityCategory({ id: c.id, name: c.name, metadata: deepFreeze({ seeded: true }) }));
}

export function buildCapabilityRuntimeSeed({ categories } = {}) {
  const cats = Array.isArray(categories) && categories.length ? categories : buildDefaultCategories();
  return deepFreeze({
    capabilities: deepFreeze([]),
    categories: deepFreeze(cats),
    metrics: deepFreeze({
      totalCapabilities: 0,
      activeCapabilities: 0,
      capabilitiesByCategory: deepFreeze({}),
      capabilitiesByProvider: deepFreeze({}),
    }),
  });
}

export function buildCapabilityForSeed({ id, overrides } = {}) {
  const merged = {
    id,
    name: "Deterministic Capability",
    description: "A deterministic capability definition.",
    category: "operations",
    level: 3,
    status: "active",
    requirements: [],
    providedBy: ["human"],
    requiredKnowledge: [],
    requiredConnectedSystems: [],
    metadata: {},
    ...(overrides ?? {}),
  };

  // Note: capability factory lives in Capability.js; keep builder responsibilities focused.
  return createCapability(merged);
}

