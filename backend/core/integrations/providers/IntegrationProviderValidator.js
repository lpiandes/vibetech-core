function fail(message) {
  throw new Error(`IntegrationProviderValidator: ${message}`);
}

export function validateIntegrationProvider(provider) {
  if (!provider || typeof provider !== "object") fail("provider required.");
  if (!provider.id) fail("provider.id required.");
  if (!provider.displayName) fail("provider.displayName required.");
  if (!Array.isArray(provider.supportedConnectionTypes) || !provider.supportedConnectionTypes.length) {
    fail("provider.supportedConnectionTypes required.");
  }
  if (!Array.isArray(provider.supportedCapabilities) || !provider.supportedCapabilities.length) {
    fail("provider.supportedCapabilities required.");
  }
  if (typeof provider.verifyConnection !== "function") fail("provider.verifyConnection required.");
  if (typeof provider.executeAction !== "function") fail("provider.executeAction required.");
  return true;
}

export function providerSupportsCapability(provider, capability) {
  return (provider?.supportedCapabilities ?? []).includes(String(capability ?? ""));
}

export function providerSupportsConnectionType(provider, connectionType) {
  return (provider?.supportedConnectionTypes ?? []).includes(String(connectionType ?? ""));
}
