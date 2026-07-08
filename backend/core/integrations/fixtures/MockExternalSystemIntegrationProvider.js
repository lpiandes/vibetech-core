import { IntegrationProvider } from "../providers/IntegrationProvider.js";
import { INTEGRATION_CAPABILITIES } from "../capabilities/IntegrationCapability.js";
import { createProviderSetupGuidance } from "../providers/ProviderSetupGuidance.js";
import { deepFreeze } from "../../workspace/_utils/deepFreeze.js";

export class MockExternalSystemIntegrationProvider extends IntegrationProvider {
  constructor({ nowISO = "2026-07-01T00:00:00.000Z" } = {}) {
    super();
    this._nowISO = String(nowISO);
  }

  get id() {
    return "provider_mock_external";
  }

  get displayName() {
    return "Mock External Business System";
  }

  get supportedConnectionTypes() {
    return ["property_management_system", "accounting", "document_storage"];
  }

  get supportedCapabilities() {
    return [
      INTEGRATION_CAPABILITIES.READ_EXTERNAL_RECORD,
      INTEGRATION_CAPABILITIES.UPDATE_EXTERNAL_RECORD,
      INTEGRATION_CAPABILITIES.CREATE_EXTERNAL_RECORD,
      INTEGRATION_CAPABILITIES.INGEST_DOCUMENT,
    ];
  }

  getSetupGuidance() {
    return createProviderSetupGuidance({
      title: "Connect Mock External System",
      summary: "Generic external system adapter for universality proof.",
      estimatedTime: "5 minutes",
      prerequisites: ["API access from system administrator"],
      steps: ["Choose system type", "Enter API credentials", "Verify read access"],
      permissionsRequested: ["read_records", "write_records"],
      verificationMethod: "Read a sample external record.",
      commonProblems: ["Invalid API scope."],
      reconnectInstructions: "Re-authorize API credentials.",
    });
  }

  async verifyConnection({ connection } = {}) {
    if (!connection?.credentialReference) {
      return deepFreeze({
        status: "failed",
        verifiedAt: this._nowISO,
        capabilitiesVerified: [],
        code: "missing_credentials",
        message: "Credential reference required.",
      });
    }
    return deepFreeze({
      status: "success",
      verifiedAt: this._nowISO,
      capabilitiesVerified: this.supportedCapabilities,
      code: "verified",
      message: "Mock external system verified.",
    });
  }

  async executeAction({ actionRequest } = {}) {
    return deepFreeze({
      externalReference: `mock_ext_${actionRequest.id}`,
      status: "completed",
      completedAt: this._nowISO,
      metadata: deepFreeze({ capability: actionRequest.capability }),
    });
  }

  normalizeInboundEvent({ payload } = {}) {
    if (!payload || typeof payload !== "object") return null;
    return deepFreeze({
      provider: this.id,
      externalEventId: String(payload.id ?? payload.eventId ?? ""),
      occurredAt: String(payload.occurredAt ?? this._nowISO),
      eventType: String(payload.eventType ?? "external_record_changed"),
      channel: "external_system",
      normalizedFacts: deepFreeze({
        recordId: String(payload.recordId ?? ""),
        changeType: String(payload.changeType ?? "updated"),
      }),
      metadata: deepFreeze({}),
    });
  }

  validateWebhook({ payload, headers } = {}) {
    const token = headers?.["x-mock-token"];
    if (token !== "valid") return { valid: false, reason: "invalid_signature" };
    if (!payload?.id) return { valid: false, reason: "missing_event_id" };
    return { valid: true };
  }
}
