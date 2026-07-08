import { createConnection } from "./Connection.js";
import { CONNECTION_STATUSES } from "./ConnectionStatus.js";
import { CONNECTION_EVENT_TYPES } from "./ConnectionEventTypes.js";
import { getCapabilitiesForConnectionType } from "./ConnectionTypeCatalog.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

function fail(message) {
  throw new Error(`ConnectionEventEngine: ${message}`);
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export class ConnectionEventEngine {
  constructor({ runtime } = {}) {
    if (!runtime) fail("runtime required.");
    this.runtime = runtime;
  }

  apply(event) {
    const type = String(event?.type ?? "");
    const timestampISO = String(event?.timestampISO ?? "2026-07-01T00:00:00.000Z");
    const payload = event?.payload ?? {};
    const state = this.runtime._state;
    const connections = [...(state.connections ?? [])];
    const actionHistory = [...(state.actionHistory ?? [])];

    switch (type) {
      case CONNECTION_EVENT_TYPES.CONNECTION_REGISTERED: {
        const conn = payload.connection;
        if (!conn || !isPlainObject(conn)) fail("CONNECTION_REGISTERED: connection required.");
        if (connections.some((c) => c.id === conn.id)) fail("CONNECTION_REGISTERED: connection exists.");
        const capabilities = conn.capabilities?.length ? conn.capabilities : getCapabilitiesForConnectionType(conn.connectionType);
        connections.push(
          createConnection({
            ...conn,
            capabilities,
            status: CONNECTION_STATUSES.NOT_CONNECTED,
            createdAt: timestampISO,
            updatedAt: timestampISO,
          }),
        );
        break;
      }
      case CONNECTION_EVENT_TYPES.CONNECTION_CONFIGURATION_STARTED: {
        const connectionId = String(payload.connectionId ?? "");
        const idx = connections.findIndex((c) => c.id === connectionId);
        if (idx === -1) fail("CONNECTION_CONFIGURATION_STARTED: connection not found.");
        const existing = connections[idx];
        connections[idx] = createConnection({
          ...existing,
          status: CONNECTION_STATUSES.CONFIGURING,
          providerType: payload.providerType ?? existing.providerType,
          configurationReference: payload.configurationReference ?? existing.configurationReference,
          credentialReference: payload.credentialReference ?? existing.credentialReference,
          updatedAt: timestampISO,
        });
        break;
      }
      case CONNECTION_EVENT_TYPES.CONNECTION_CONNECTED: {
        const connectionId = String(payload.connectionId ?? "");
        const idx = connections.findIndex((c) => c.id === connectionId);
        if (idx === -1) fail("CONNECTION_CONNECTED: connection not found.");
        const existing = connections[idx];
        connections[idx] = createConnection({
          ...existing,
          status: CONNECTION_STATUSES.CONNECTED,
          providerType: payload.providerType ?? existing.providerType,
          externalAccountReference: payload.externalAccountReference ?? existing.externalAccountReference,
          connectedAt: payload.connectedAt ?? timestampISO,
          updatedAt: timestampISO,
        });
        break;
      }
      case CONNECTION_EVENT_TYPES.CONNECTION_VERIFIED: {
        const connectionId = String(payload.connectionId ?? "");
        const idx = connections.findIndex((c) => c.id === connectionId);
        if (idx === -1) fail("CONNECTION_VERIFIED: connection not found.");
        const existing = connections[idx];
        connections[idx] = createConnection({
          ...existing,
          status: CONNECTION_STATUSES.CONNECTED,
          lastVerifiedAt: payload.verifiedAt ?? timestampISO,
          health: payload.health ?? deepFreeze({ level: "HEALTHY", verifiedAt: timestampISO }),
          capabilities: payload.capabilitiesVerified ?? existing.capabilities,
          updatedAt: timestampISO,
        });
        break;
      }
      case CONNECTION_EVENT_TYPES.CONNECTION_DEGRADED: {
        const connectionId = String(payload.connectionId ?? "");
        const idx = connections.findIndex((c) => c.id === connectionId);
        if (idx === -1) fail("CONNECTION_DEGRADED: connection not found.");
        const existing = connections[idx];
        connections[idx] = createConnection({
          ...existing,
          status: CONNECTION_STATUSES.DEGRADED,
          health: payload.health ?? deepFreeze({ level: "NEEDS_ATTENTION", message: payload.message ?? "" }),
          updatedAt: timestampISO,
        });
        break;
      }
      case CONNECTION_EVENT_TYPES.CONNECTION_FAILED: {
        const connectionId = String(payload.connectionId ?? "");
        const idx = connections.findIndex((c) => c.id === connectionId);
        if (idx === -1) fail("CONNECTION_FAILED: connection not found.");
        const existing = connections[idx];
        connections[idx] = createConnection({
          ...existing,
          status: CONNECTION_STATUSES.ERROR,
          lastFailureAt: timestampISO,
          health: payload.health ?? deepFreeze({ level: "ERROR", message: payload.message ?? "", code: payload.code ?? "" }),
          updatedAt: timestampISO,
        });
        break;
      }
      case CONNECTION_EVENT_TYPES.CONNECTION_DISCONNECTED: {
        const connectionId = String(payload.connectionId ?? "");
        const idx = connections.findIndex((c) => c.id === connectionId);
        if (idx === -1) fail("CONNECTION_DISCONNECTED: connection not found.");
        const existing = connections[idx];
        connections[idx] = createConnection({
          ...existing,
          status: CONNECTION_STATUSES.DISCONNECTED,
          credentialReference: null,
          externalAccountReference: null,
          health: deepFreeze({ level: "DISCONNECTED" }),
          updatedAt: timestampISO,
        });
        break;
      }
      case CONNECTION_EVENT_TYPES.CONNECTION_ACTIVITY_RECORDED: {
        const connectionId = String(payload.connectionId ?? "");
        const idx = connections.findIndex((c) => c.id === connectionId);
        if (idx === -1) fail("CONNECTION_ACTIVITY_RECORDED: connection not found.");
        const existing = connections[idx];
        if (payload.actionResult) actionHistory.push(deepFreeze(payload.actionResult));
        connections[idx] = createConnection({
          ...existing,
          lastSuccessfulActivityAt: payload.success ? timestampISO : existing.lastSuccessfulActivityAt,
          lastFailureAt: payload.success ? existing.lastFailureAt : timestampISO,
          updatedAt: timestampISO,
        });
        break;
      }
      default:
        fail(`unsupported event type: ${type}`);
    }

    this.runtime._state = deepFreeze({
      ...state,
      connections: deepFreeze(connections),
      actionHistory: deepFreeze(actionHistory),
      metrics: deepFreeze({
        connectionCount: connections.length,
        connectedCount: connections.filter((c) => c.status === CONNECTION_STATUSES.CONNECTED).length,
        actionCount: actionHistory.length,
      }),
    });
    return this.runtime._state;
  }
}
