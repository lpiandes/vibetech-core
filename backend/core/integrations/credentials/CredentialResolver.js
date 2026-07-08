function fail(message) {
  throw new Error(`CredentialResolver: ${message}`);
}

/**
 * Resolves credential references to provider-safe configuration.
 * Production: vault-backed. Development: mock resolver injects test doubles only.
 * Never returns secrets to callers that publish events or view models.
 */
export class CredentialResolver {
  constructor({ resolvers } = {}) {
    this._resolvers = new Map();
    if (resolvers && typeof resolvers === "object") {
      for (const [providerType, fn] of Object.entries(resolvers)) {
        this.register(providerType, fn);
      }
    }
  }

  register(providerType, resolverFn) {
    if (!providerType || typeof resolverFn !== "function") fail("providerType and resolverFn required.");
    this._resolvers.set(String(providerType), resolverFn);
    return resolverFn;
  }

  resolve(credentialReference) {
    const ref = credentialReference ?? {};
    const providerType = String(ref.providerType ?? "");
    const resolver = this._resolvers.get(providerType);
    if (!resolver) fail(`no credential resolver for providerType: ${providerType}`);
    const resolved = resolver(ref);
    if (!resolved || typeof resolved !== "object") fail("resolver must return object.");
    return resolved;
  }
}
