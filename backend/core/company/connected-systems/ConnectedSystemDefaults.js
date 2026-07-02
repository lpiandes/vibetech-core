export function createConnectedSystemDefaults() {
  return Object.freeze({
    status: "NOT_STARTED",
    health: "DEGRADED",
    configured: false,
    authenticated: false,
    lastValidated: "",
    features: [],
    capabilitiesUnlocked: [],
    metadata: {},
  });
}

