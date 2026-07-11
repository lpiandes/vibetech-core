import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";
import { CONNECTION_HEALTH_LEVELS } from "../connections/ConnectionStatus.js";
import { buildConnectionHealth } from "../health/ConnectionHealthEngine.js";

/**
 * Hub health statuses — maps onto existing ConnectionHealthEngine levels.
 */
export const HUB_HEALTH_STATUSES = deepFreeze({
  connected: { statusId: "connected", label: "Connected", mapsTo: CONNECTION_HEALTH_LEVELS.HEALTHY },
  needs_attention: { statusId: "needs_attention", label: "Needs Attention", mapsTo: CONNECTION_HEALTH_LEVELS.NEEDS_ATTENTION },
  disconnected: { statusId: "disconnected", label: "Disconnected", mapsTo: CONNECTION_HEALTH_LEVELS.DISCONNECTED },
  error: { statusId: "error", label: "Error", mapsTo: CONNECTION_HEALTH_LEVELS.ERROR },
  syncing: { statusId: "syncing", label: "Syncing", mapsTo: CONNECTION_HEALTH_LEVELS.NEEDS_ATTENTION },
  paused: { statusId: "paused", label: "Paused", mapsTo: CONNECTION_HEALTH_LEVELS.NEEDS_ATTENTION },
  deprecated: { statusId: "deprecated", label: "Deprecated", mapsTo: CONNECTION_HEALTH_LEVELS.NEEDS_ATTENTION },
});

export function resolveHubHealthStatus(connection = null, { hubFlags = {} } = {}) {
  if (hubFlags.deprecated) {
    return deepFreeze({ ...HUB_HEALTH_STATUSES.deprecated, reasons: ["provider_deprecated"] });
  }
  if (hubFlags.paused) {
    return deepFreeze({ ...HUB_HEALTH_STATUSES.paused, reasons: ["paused_by_user"] });
  }
  if (hubFlags.syncing) {
    return deepFreeze({ ...HUB_HEALTH_STATUSES.syncing, reasons: ["sync_in_progress"] });
  }

  const base = buildConnectionHealth(connection);
  switch (base.level) {
    case CONNECTION_HEALTH_LEVELS.HEALTHY:
      return deepFreeze({ ...HUB_HEALTH_STATUSES.connected, reasons: base.reasons, connectionId: base.connectionId });
    case CONNECTION_HEALTH_LEVELS.NEEDS_ATTENTION:
      return deepFreeze({ ...HUB_HEALTH_STATUSES.needs_attention, reasons: base.reasons, connectionId: base.connectionId });
    case CONNECTION_HEALTH_LEVELS.ERROR:
      return deepFreeze({ ...HUB_HEALTH_STATUSES.error, reasons: base.reasons, connectionId: base.connectionId });
    default:
      return deepFreeze({ ...HUB_HEALTH_STATUSES.disconnected, reasons: base.reasons, connectionId: base.connectionId });
  }
}
