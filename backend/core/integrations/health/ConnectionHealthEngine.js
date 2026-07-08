import { CONNECTION_STATUSES, CONNECTION_HEALTH_LEVELS } from "../connections/ConnectionStatus.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function safeString(v) {
  return v === null || v === undefined ? "" : String(v);
}

export function buildConnectionHealth(connection) {
  if (!connection) {
    return deepFreeze({ level: CONNECTION_HEALTH_LEVELS.DISCONNECTED, reasons: deepFreeze(["not_registered"]) });
  }

  const status = safeString(connection.status);
  const reasons = [];

  if (status === CONNECTION_STATUSES.NOT_CONNECTED || status === CONNECTION_STATUSES.DISCONNECTED) {
    return deepFreeze({
      level: CONNECTION_HEALTH_LEVELS.DISCONNECTED,
      reasons: deepFreeze(["not_connected"]),
      connectionId: connection.id,
      status,
    });
  }

  if (status === CONNECTION_STATUSES.ERROR) {
    return deepFreeze({
      level: CONNECTION_HEALTH_LEVELS.ERROR,
      reasons: deepFreeze([connection.health?.message || "connection_error"]),
      connectionId: connection.id,
      status,
      lastFailureAt: connection.lastFailureAt,
    });
  }

  if (status === CONNECTION_STATUSES.DEGRADED || status === CONNECTION_STATUSES.CONFIGURING) {
    return deepFreeze({
      level: CONNECTION_HEALTH_LEVELS.NEEDS_ATTENTION,
      reasons: deepFreeze([connection.health?.message || status.toLowerCase()]),
      connectionId: connection.id,
      status,
    });
  }

  if (!connection.lastVerifiedAt) reasons.push("not_verified");

  const level =
    reasons.length > 0 ? CONNECTION_HEALTH_LEVELS.NEEDS_ATTENTION : CONNECTION_HEALTH_LEVELS.HEALTHY;

  return deepFreeze({
    level,
    reasons: deepFreeze(reasons),
    connectionId: connection.id,
    status,
    lastVerifiedAt: connection.lastVerifiedAt,
    lastSuccessfulActivityAt: connection.lastSuccessfulActivityAt,
    lastFailureAt: connection.lastFailureAt,
  });
}

export function buildConnectionHealthReport({ connectionRuntime } = {}) {
  const connections = connectionRuntime?.getConnections?.() ?? [];
  return deepFreeze({
    connections: deepFreeze(connections.map((c) => buildConnectionHealth(c))),
    summary: deepFreeze({
      healthy: connections.filter((c) => buildConnectionHealth(c).level === CONNECTION_HEALTH_LEVELS.HEALTHY).length,
      needsAttention: connections.filter((c) => buildConnectionHealth(c).level === CONNECTION_HEALTH_LEVELS.NEEDS_ATTENTION).length,
      disconnected: connections.filter((c) => buildConnectionHealth(c).level === CONNECTION_HEALTH_LEVELS.DISCONNECTED).length,
      error: connections.filter((c) => buildConnectionHealth(c).level === CONNECTION_HEALTH_LEVELS.ERROR).length,
    }),
  });
}
