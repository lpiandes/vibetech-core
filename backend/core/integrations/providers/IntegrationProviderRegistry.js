import { validateIntegrationProvider } from "./IntegrationProviderValidator.js";

function fail(message) {
  throw new Error(`IntegrationProviderRegistry: ${message}`);
}

export class IntegrationProviderRegistry {
  constructor({ providers } = {}) {
    this._providers = new Map();
    if (providers && typeof providers === "object") {
      for (const provider of Object.values(providers)) {
        this.register(provider);
      }
    }
  }

  register(provider) {
    validateIntegrationProvider(provider);
    const id = String(provider.id);
    if (this._providers.has(id)) fail(`duplicate provider id: ${id}`);
    this._providers.set(id, provider);
    return provider;
  }

  getProvider(id) {
    return this._providers.get(String(id ?? "")) ?? null;
  }

  listProviders() {
    return [...this._providers.values()];
  }

  findByConnectionType(connectionType) {
    const ct = String(connectionType ?? "");
    return this.listProviders().filter((p) => p.supportedConnectionTypes.includes(ct));
  }

  findByCapability(capability) {
    const cap = String(capability ?? "");
    return this.listProviders().filter((p) => p.supportedCapabilities.includes(cap));
  }
}

export function createDefaultIntegrationProviderRegistry({ providers } = {}) {
  return new IntegrationProviderRegistry({ providers });
}
