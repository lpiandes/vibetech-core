import { createConnection } from "../connections/Connection.js";
import { CONNECTION_EVENT_TYPES } from "../connections/ConnectionEventTypes.js";
import { CONNECTION_STATUSES } from "../connections/ConnectionStatus.js";
import { createCredentialReference } from "../credentials/CredentialReference.js";
import { getCapabilitiesForConnectionType } from "../connections/ConnectionTypeCatalog.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

/**
 * Connection lifecycle use cases.
 * START_CONNECTION → AUTHORIZE (credential ref) → VERIFY → ACTIVATE
 */
export class ConnectionService {
  constructor({
    connectionRuntime,
    providerRegistry,
    integrationPlatformEventPublisher = null,
    nowISO = "2026-07-01T00:00:00.000Z",
  } = {}) {
    this.connectionRuntime = connectionRuntime;
    this.providerRegistry = providerRegistry;
    this.integrationPlatformEventPublisher = integrationPlatformEventPublisher;
    this.nowISO = String(nowISO);
  }

  #publishPlatformEvent({ eventType, connectionId, payload, eventId } = {}) {
    if (!this.integrationPlatformEventPublisher?.publish) return;
    const connection = this.connectionRuntime.getConnection(connectionId);
    this.integrationPlatformEventPublisher.publish({
      eventId,
      eventType,
      aggregateId: connectionId,
      payload: {
        connectionId,
        connectionType: connection?.connectionType ?? null,
        displayName: connection?.displayName ?? null,
        ...(payload ?? {}),
      },
      metadata: { workspaceId: connection?.workspaceId ?? null },
    });
  }

  registerRequirement({ workspaceId, connectionType, displayName, providerType = null } = {}) {
    const id = `conn_${workspaceId}_${connectionType}`;
    const existing = this.connectionRuntime.getConnection(id);
    if (existing) return existing;

    const connection = createConnection({
      id,
      workspaceId,
      connectionType,
      providerType,
      displayName,
      capabilities: getCapabilitiesForConnectionType(connectionType),
      status: CONNECTION_STATUSES.NOT_CONNECTED,
      createdAt: this.nowISO,
      updatedAt: this.nowISO,
    });

    this.connectionRuntime.applyEvent({
      id: `evt_${CONNECTION_EVENT_TYPES.CONNECTION_REGISTERED}_${id}`,
      timestampISO: this.nowISO,
      type: CONNECTION_EVENT_TYPES.CONNECTION_REGISTERED,
      source: "connection_service",
      payload: { connection },
    });
    return this.connectionRuntime.getConnection(id);
  }

  startConfiguration({ connectionId, providerType } = {}) {
    const provider = this.providerRegistry.getProvider(providerType);
    if (!provider) throw new Error(`ConnectionService: unknown provider: ${providerType}`);

    this.connectionRuntime.applyEvent({
      id: `evt_${CONNECTION_EVENT_TYPES.CONNECTION_CONFIGURATION_STARTED}_${connectionId}`,
      timestampISO: this.nowISO,
      type: CONNECTION_EVENT_TYPES.CONNECTION_CONFIGURATION_STARTED,
      source: "connection_service",
      payload: {
        connectionId,
        providerType,
        configurationReference: deepFreeze({ providerType, startedAt: this.nowISO }),
      },
    });
    return this.connectionRuntime.getConnection(connectionId);
  }

  attachMockCredentials({ connectionId, providerType } = {}) {
    return this.attachProviderCredentials({
      connectionId,
      providerType,
      credentialType: "mock",
      externalAccountReference: `mock_account_${connectionId}`,
      metadata: { mock: true },
    });
  }

  /**
   * Attach a credential reference and mark the connection as connected.
   * Secrets live in CredentialVault keyed by credentialId — never in events.
   */
  attachProviderCredentials({
    connectionId,
    providerType,
    credentialId = null,
    credentialType = "oauth2",
    externalAccountReference = null,
    metadata = {},
  } = {}) {
    const credentialReference = createCredentialReference({
      credentialId: String(credentialId ?? `cred_${connectionId}`),
      credentialType: String(credentialType),
      providerType,
      metadata: metadata && typeof metadata === "object" ? metadata : {},
    });

    this.connectionRuntime.applyEvent({
      id: `evt_${CONNECTION_EVENT_TYPES.CONNECTION_CONFIGURATION_STARTED}_${connectionId}_cred`,
      timestampISO: this.nowISO,
      type: CONNECTION_EVENT_TYPES.CONNECTION_CONFIGURATION_STARTED,
      source: "connection_service",
      payload: { connectionId, providerType, credentialReference },
    });

    this.connectionRuntime.applyEvent({
      id: `evt_${CONNECTION_EVENT_TYPES.CONNECTION_CONNECTED}_${connectionId}`,
      timestampISO: this.nowISO,
      type: CONNECTION_EVENT_TYPES.CONNECTION_CONNECTED,
      source: "connection_service",
      payload: {
        connectionId,
        providerType,
        externalAccountReference: String(externalAccountReference ?? `account_${connectionId}`),
        connectedAt: this.nowISO,
      },
    });
    this.#publishPlatformEvent({
      eventType: "CONNECTION_CONNECTED",
      connectionId,
      eventId: `evt_${CONNECTION_EVENT_TYPES.CONNECTION_CONNECTED}_${connectionId}`,
      payload: { providerType, connectedAt: this.nowISO },
    });
    return this.connectionRuntime.getConnection(connectionId);
  }

  async verifyConnection({ connectionId, credentialResolver } = {}) {
    const connection = this.connectionRuntime.getConnection(connectionId);
    if (!connection) throw new Error(`ConnectionService: connection not found: ${connectionId}`);
    const provider = this.providerRegistry.getProvider(connection.providerType);
    if (!provider) throw new Error(`ConnectionService: provider not found: ${connection.providerType}`);

    const verification = await provider.verifyConnection({ connection, credentialResolver });

    if (verification.status === "success") {
      this.connectionRuntime.applyEvent({
        id: `evt_${CONNECTION_EVENT_TYPES.CONNECTION_VERIFIED}_${connectionId}`,
        timestampISO: this.nowISO,
        type: CONNECTION_EVENT_TYPES.CONNECTION_VERIFIED,
        source: "connection_service",
        payload: {
          connectionId,
          verifiedAt: verification.verifiedAt ?? this.nowISO,
          capabilitiesVerified: verification.capabilitiesVerified ?? connection.capabilities,
          health: deepFreeze({
            level: "HEALTHY",
            verifiedAt: verification.verifiedAt ?? this.nowISO,
            code: verification.code ?? "verified",
            message: verification.message ?? "",
          }),
        },
      });
      this.#publishPlatformEvent({
        eventType: "CONNECTION_VERIFIED",
        connectionId,
        eventId: `evt_${CONNECTION_EVENT_TYPES.CONNECTION_VERIFIED}_${connectionId}`,
        payload: { verifiedAt: verification.verifiedAt ?? this.nowISO },
      });
    } else {
      this.connectionRuntime.applyEvent({
        id: `evt_${CONNECTION_EVENT_TYPES.CONNECTION_FAILED}_${connectionId}`,
        timestampISO: this.nowISO,
        type: CONNECTION_EVENT_TYPES.CONNECTION_FAILED,
        source: "connection_service",
        payload: {
          connectionId,
          code: verification.code ?? "verification_failed",
          message: verification.message ?? "Verification failed.",
          health: deepFreeze({ level: "ERROR", code: verification.code, message: verification.message }),
        },
      });
      this.#publishPlatformEvent({
        eventType: "CONNECTION_FAILED",
        connectionId,
        eventId: `evt_${CONNECTION_EVENT_TYPES.CONNECTION_FAILED}_${connectionId}`,
        payload: {
          code: verification.code ?? "verification_failed",
          message: verification.message ?? "Verification failed.",
        },
      });
    }

    return { verification, connection: this.connectionRuntime.getConnection(connectionId) };
  }

  disconnect({ connectionId } = {}) {
    this.connectionRuntime.applyEvent({
      id: `evt_${CONNECTION_EVENT_TYPES.CONNECTION_DISCONNECTED}_${connectionId}`,
      timestampISO: this.nowISO,
      type: CONNECTION_EVENT_TYPES.CONNECTION_DISCONNECTED,
      source: "connection_service",
      payload: { connectionId },
    });
    return this.connectionRuntime.getConnection(connectionId);
  }

  degrade({ connectionId, message } = {}) {
    this.connectionRuntime.applyEvent({
      id: `evt_${CONNECTION_EVENT_TYPES.CONNECTION_DEGRADED}_${connectionId}`,
      timestampISO: this.nowISO,
      type: CONNECTION_EVENT_TYPES.CONNECTION_DEGRADED,
      source: "connection_service",
      payload: {
        connectionId,
        message,
        health: deepFreeze({ level: "NEEDS_ATTENTION", message }),
      },
    });
    return this.connectionRuntime.getConnection(connectionId);
  }

  updateMetadata({ connectionId, metadata = {} } = {}) {
    if (!connectionId) throw new Error("ConnectionService: connectionId required.");
    this.connectionRuntime.applyEvent({
      id: `evt_${CONNECTION_EVENT_TYPES.CONNECTION_METADATA_UPDATED}_${connectionId}_${Date.now()}`,
      timestampISO: this.nowISO,
      type: CONNECTION_EVENT_TYPES.CONNECTION_METADATA_UPDATED,
      source: "connection_service",
      payload: {
        connectionId,
        metadata: metadata && typeof metadata === "object" ? metadata : {},
      },
    });
    return this.connectionRuntime.getConnection(connectionId);
  }
}
