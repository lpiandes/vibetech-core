import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { HUB_CAPABILITIES } from "./ProviderCatalog.js";

/**
 * Map integration hub model → existing Business OS / readiness fields.
 * Does not invent a parallel schema.
 */
export function mapIntegrationsToBusinessOS(integrationModel = {}) {
  const connections = integrationModel.connections ?? [];

  const integrationRequirements = connections.map((connection) => ({
    requirementId: `req_${connection.providerId}`,
    providerId: connection.providerId,
    label: connection.label,
    connectionType: connection.connectionType,
    status: connection.health?.statusId ?? "disconnected",
    required: Boolean(connection.recommended),
    capabilities: connection.capabilities ?? [],
  }));

  const connectedSystemDefinitions = connections.map((connection) => ({
    systemId: connection.providerId,
    label: connection.label,
    category: connection.category,
    authMethod: connection.authMethod,
    capabilities: connection.capabilities ?? [],
  }));

  const capabilityRequirements = unique(
    connections.flatMap((connection) => connection.capabilities ?? []),
  ).map((capabilityId) => ({
    capabilityId,
    label: HUB_CAPABILITIES[capabilityId]?.label ?? capabilityId,
    platformCapability: HUB_CAPABILITIES[capabilityId]?.platform ?? null,
    satisfiedBy: connections
      .filter((connection) => (connection.capabilities ?? []).includes(capabilityId))
      .map((connection) => connection.providerId),
  }));

  return deepFreeze({
    integrationRequirements,
    connectedSystemDefinitions,
    capabilityRequirements,
    tenantIsolation: {
      scopedByBusinessId: true,
      noCrossTenantCredentials: true,
      businessId: integrationModel.businessId ?? null,
    },
  });
}

function unique(items) {
  return [...new Set(items.map(String))];
}
