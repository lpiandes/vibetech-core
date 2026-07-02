function fail(message) {
  throw new Error(`CommunicationProviderRegistry: ${message}`);
}

export class CommunicationProviderRegistry {
  constructor() {
    this._providersById = new Map();
  }

  register(provider) {
    const id = String(provider?.id ?? "");
    if (!id) fail("provider.id required.");
    if (this._providersById.has(id)) fail(`provider already registered: ${id}`);
    this._providersById.set(id, provider);
    return { ok: true };
  }

  unregister(providerId) {
    const id = String(providerId ?? "");
    if (!this._providersById.has(id)) return { ok: false, removed: false };
    this._providersById.delete(id);
    return { ok: true, removed: true };
  }

  getProvider(providerId) {
    const id = String(providerId ?? "");
    return this._providersById.get(id) ?? null;
  }

  getProvidersByChannel(channel) {
    const ch = String(channel ?? "");
    const list = [];
    for (const p of this._providersById.values()) {
      const supported = Array.isArray(p?.supportedChannels) ? p.supportedChannels.map(String) : [];
      if (supported.includes(ch)) list.push(p);
    }
    // Deterministic: sort by provider id.
    list.sort((a, b) => String(a.id).localeCompare(String(b.id)));
    return deepFreeze(list);
  }
}

function deepFreeze(value) {
  if (!value || typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

