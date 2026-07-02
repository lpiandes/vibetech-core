import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { CAPABILITY_EVENT_TYPES, SUPPORTED_CAPABILITY_EVENT_TYPES } from "./CapabilityEventTypes.js";

import { createCapability } from "./Capability.js";
import { createCapabilityCategory } from "./CapabilityCategory.js";
import { createCapabilityMetrics } from "./CapabilityMetrics.js";

function fail(message) {
  throw new Error(`CapabilityEventEngine: ${message}`);
}

function requireString(v, name) {
  if (!v || typeof v !== "string") fail(`${name} required string.`);
  return v;
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function safeClone(arr) {
  return Array.isArray(arr) ? [...arr] : [];
}

function computeMetrics({ capabilities }) {
  const total = capabilities.length;
  const active = capabilities.filter((c) => String(c.status) === "active").length;

  const byCategory = {};
  const byProvider = {};
  for (const c of capabilities) {
    const cat = String(c.category);
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
    for (const p of Array.isArray(c.providedBy) ? c.providedBy : []) {
      const ps = String(p);
      byProvider[ps] = (byProvider[ps] ?? 0) + 1;
    }
  }

  return createCapabilityMetrics({
    totalCapabilities: total,
    activeCapabilities: active,
    capabilitiesByCategory: byCategory,
    capabilitiesByProvider: byProvider,
  });
}

function ensureCategoryExists({ nextCategories, categoryId }) {
  const cid = String(categoryId);
  const exists = nextCategories.some((c) => String(c.id) === cid);
  if (exists) return nextCategories;
  const added = createCapabilityCategory({ id: cid, name: cid, metadata: { createdBy: "auto" } });
  return [...nextCategories, added];
}

export class CapabilityEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) fail("CapabilityEventEngine requires runtime.");
    this.runtime = runtime;
  }

  apply(event) {
    requireString(event?.id, "event.id");
    requireString(event?.timestampISO, "event.timestampISO");
    requireString(event?.type, "event.type");
    requireString(event?.source, "event.source");

    if (!isPlainObject(event?.payload)) fail("event.payload must be plain object.");

    const type = String(event.type);
    if (!SUPPORTED_CAPABILITY_EVENT_TYPES.includes(type)) fail(`Unsupported event type: ${type}`);

    const prev = this.runtime._state;
    const nextCapabilities = safeClone(prev.capabilities);
    let nextCategories = safeClone(prev.categories);

    switch (type) {
      case CAPABILITY_EVENT_TYPES.CAPABILITY_REGISTERED: {
        const { capability } = event.payload ?? {};
        if (!isPlainObject(capability)) fail("CAPABILITY_REGISTERED requires payload.capability object.");
        const created = createCapability(capability);
        if (nextCapabilities.some((c) => String(c.id) === String(created.id))) fail("capability already exists.");
        nextCapabilities.push(created);
        nextCategories = ensureCategoryExists({ nextCategories, categoryId: created.category });
        break;
      }

      case CAPABILITY_EVENT_TYPES.CAPABILITY_UPDATED: {
        const { capabilityId, patch } = event.payload ?? {};
        requireString(capabilityId, "payload.capabilityId");
        if (!isPlainObject(patch)) fail("CAPABILITY_UPDATED requires payload.patch plain object.");
        const idx = nextCapabilities.findIndex((c) => String(c.id) === String(capabilityId));
        if (idx === -1) fail("CAPABILITY_UPDATED: capability does not exist.");
        const prevCap = nextCapabilities[idx];

        const merged = {
          ...prevCap,
          ...(patch ?? {}),
          id: String(capabilityId),
        };

        const updated = createCapability(merged);
        nextCapabilities[idx] = updated;
        nextCategories = ensureCategoryExists({ nextCategories, categoryId: updated.category });
        break;
      }

      case CAPABILITY_EVENT_TYPES.CAPABILITY_ARCHIVED: {
        const { capabilityId } = event.payload ?? {};
        requireString(capabilityId, "payload.capabilityId");
        const idx = nextCapabilities.findIndex((c) => String(c.id) === String(capabilityId));
        if (idx === -1) fail("CAPABILITY_ARCHIVED: capability does not exist.");
        const prevCap = nextCapabilities[idx];
        const archived = createCapability({ ...prevCap, status: "archived" });
        nextCapabilities[idx] = archived;
        break;
      }

      case CAPABILITY_EVENT_TYPES.CAPABILITY_PROVIDER_ADDED: {
        const { capabilityId, provider } = event.payload ?? {};
        requireString(capabilityId, "payload.capabilityId");
        requireString(provider, "payload.provider");
        const idx = nextCapabilities.findIndex((c) => String(c.id) === String(capabilityId));
        if (idx === -1) fail("CAPABILITY_PROVIDER_ADDED: capability does not exist.");
        const prevCap = nextCapabilities[idx];
        const providers = Array.isArray(prevCap.providedBy) ? prevCap.providedBy.map((p) => String(p)) : [];
        const ps = String(provider);
        if (!providers.includes(ps)) providers.push(ps);
        const updated = createCapability({ ...prevCap, providedBy: providers });
        nextCapabilities[idx] = updated;
        break;
      }

      case CAPABILITY_EVENT_TYPES.CAPABILITY_PROVIDER_REMOVED: {
        const { capabilityId, provider } = event.payload ?? {};
        requireString(capabilityId, "payload.capabilityId");
        requireString(provider, "payload.provider");
        const idx = nextCapabilities.findIndex((c) => String(c.id) === String(capabilityId));
        if (idx === -1) fail("CAPABILITY_PROVIDER_REMOVED: capability does not exist.");
        const prevCap = nextCapabilities[idx];
        const providers = Array.isArray(prevCap.providedBy) ? prevCap.providedBy.map((p) => String(p)) : [];
        const ps = String(provider);
        const next = providers.filter((p) => String(p) !== ps);
        const updated = createCapability({ ...prevCap, providedBy: next });
        nextCapabilities[idx] = updated;
        break;
      }

      default: {
        fail(`Unhandled event type: ${type}`);
      }
    }

    const nextMetrics = computeMetrics({ capabilities: nextCapabilities });
    const nextState = deepFreeze({
      ...prev,
      capabilities: deepFreeze(nextCapabilities),
      categories: deepFreeze(nextCategories),
      metrics: nextMetrics,
    });

    this.runtime._state = nextState;
  }
}

