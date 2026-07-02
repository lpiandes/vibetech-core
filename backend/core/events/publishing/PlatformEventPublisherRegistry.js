import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

import { DEFAULT_PUBLISHER_VERSION } from "./PlatformEventPublisherDefaults.js";

function fail(message) {
  throw new Error(`PlatformEventPublisherRegistry: ${message}`);
}

function requireString(value, name) {
  if (!value || typeof value !== "string") fail(`${name} required string.`);
  return value;
}

function requireFiniteInt(value, name) {
  if (typeof value !== "number" || !Number.isFinite(value) || Math.floor(value) !== value || value < 0) {
    fail(`${name} must be finite int >= 0.`);
  }
  return value;
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

function normalizeMetadata(metadata) {
  return isPlainObject(metadata) ? deepFreeze(metadata) : deepFreeze({});
}

export class PlatformEventPublisherRegistry {
  constructor({ publishers } = {}) {
    const list = Array.isArray(publishers) ? publishers : [];

    const byId = new Map();
    for (const p of list) {
      if (!p || typeof p !== "object") fail("publisher must be object.");
      const id = requireString(p.id, "publisher.id");
      if (byId.has(id)) fail(`duplicate publisher id: ${id}`);

      const name = requireString(p.name, "publisher.name");
      const operatingSystem = requireString(p.operatingSystem, "publisher.operatingSystem");
      const allowedEventTypes = Array.isArray(p.allowedEventTypes) ? p.allowedEventTypes.map((x) => String(x)) : [];
      const version = typeof p.version === "number" ? p.version : DEFAULT_PUBLISHER_VERSION;
      requireFiniteInt(version, "publisher.version");

      const metadata = normalizeMetadata(p.metadata);

      byId.set(id, deepFreeze({ id, name, operatingSystem, allowedEventTypes: deepFreeze(allowedEventTypes), version, metadata }));
    }

    this._state = deepFreeze({
      publishers: Array.from(byId.values()),
      byId: deepFreeze(Object.fromEntries(Array.from(byId.entries()))),
    });
  }

  getPublisher(publisherId) {
    const id = String(publisherId);
    return this._state.byId[id] ?? null;
  }

  getPublishers() {
    return this._state.publishers;
  }

  validatePublisher(publisher) {
    // Used by PlatformEventPublisherValidator as a convenience.
    if (!publisher || typeof publisher !== "object") fail("publisher required.");
    requireString(publisher.id, "publisher.id");
    requireString(publisher.name, "publisher.name");
    requireString(publisher.operatingSystem, "publisher.operatingSystem");
    if (!Array.isArray(publisher.allowedEventTypes)) fail("publisher.allowedEventTypes required array.");
    requireFiniteInt(Number(publisher.version), "publisher.version");
    return true;
  }
}

