import assert from "node:assert/strict";
import { test } from "node:test";

import { ConnectionRuntime } from "./connections/ConnectionRuntime.js";
import { CONNECTION_STATUSES } from "./connections/ConnectionStatus.js";
import { createCredentialReference } from "./credentials/CredentialReference.js";
import { createMockCredentialResolver } from "./credentials/MockCredentialResolver.js";
import { IntegrationProviderRegistry } from "./providers/IntegrationProviderRegistry.js";
import { MockEmailIntegrationProvider } from "./fixtures/MockEmailIntegrationProvider.js";
import { MockSmsIntegrationProvider } from "./fixtures/MockSmsIntegrationProvider.js";
import { MockExternalSystemIntegrationProvider } from "./fixtures/MockExternalSystemIntegrationProvider.js";
import { ConnectionService } from "./use-cases/ConnectionService.js";
import { ExternalActionOrchestrationService } from "./actions/ExternalActionOrchestrationService.js";
import { createExternalActionRequest, EXTERNAL_ACTION_STATUSES } from "./actions/ExternalActionRequest.js";
import { INTEGRATION_CAPABILITIES } from "./capabilities/IntegrationCapability.js";
import { WebhookIngressService } from "./inbound/WebhookIngressService.js";
import { buildConnectionDependencyProjection } from "./dependencies/ConnectionDependencyProjection.js";
import { buildDigitalEmployeeReadiness } from "../industries/employees/DigitalEmployeeReadinessEngine.js";
import { buildConnectedSystemsSnapshot } from "../industries/connections/buildConnectedSystemsSnapshot.js";
import { activateWorkspace } from "../workspace/activation/activateWorkspace.js";
import { PROPERTY_MANAGEMENT_PACKAGE } from "../../../industries/property-management/PropertyManagementPackage.js";
import { GmailIntegrationAdapter } from "./adapters/GmailIntegrationAdapter.js";
import { CommunicationRuntime } from "../communications/CommunicationRuntime.js";
import { COMMUNICATION_EVENT_TYPES } from "../communications/CommunicationEventTypes.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";
const WORKSPACE_ID = "ws_integration_test";

function buildPmInstallationResult() {
  return {
    connectedSystemRequirements: PROPERTY_MANAGEMENT_PACKAGE.connectedSystemRequirements,
    connectionGuidance: PROPERTY_MANAGEMENT_PACKAGE.connectionGuidance,
    communicationIntents: PROPERTY_MANAGEMENT_PACKAGE.communicationIntents,
    employeeDefinitions: PROPERTY_MANAGEMENT_PACKAGE.employeeDefinitions,
    automationConfigurations: PROPERTY_MANAGEMENT_PACKAGE.automationConfigurations,
  };
}

test("ConnectionRuntime: register, configure, verify, disconnect", async () => {
  const runtime = new ConnectionRuntime();
  const registry = new IntegrationProviderRegistry();
  registry.register(new MockEmailIntegrationProvider({ nowISO: NOW_ISO }));
  const service = new ConnectionService({ connectionRuntime: runtime, providerRegistry: registry, nowISO: NOW_ISO });
  const credentialResolver = createMockCredentialResolver();

  const conn = service.registerRequirement({ workspaceId: WORKSPACE_ID, connectionType: "business_email", displayName: "Business Email" });
  assert.equal(conn.status, CONNECTION_STATUSES.NOT_CONNECTED);

  service.startConfiguration({ connectionId: conn.id, providerType: "provider_mock_email" });
  service.attachMockCredentials({ connectionId: conn.id, providerType: "provider_mock_email" });
  const { verification } = await service.verifyConnection({ connectionId: conn.id, credentialResolver });
  assert.equal(verification.status, "success");
  assert.equal(runtime.getConnection(conn.id).status, CONNECTION_STATUSES.CONNECTED);

  service.disconnect({ connectionId: conn.id });
  assert.equal(runtime.getConnection(conn.id).status, CONNECTION_STATUSES.DISCONNECTED);
});

test("CredentialReference: no secrets in runtime state", () => {
  const ref = createCredentialReference({ credentialId: "cred_1", credentialType: "mock", providerType: "provider_mock_email" });
  assert.equal(ref.credentialId, "cred_1");
  assert.equal(Object.keys(ref).includes("secret"), false);
  const runtime = new ConnectionRuntime();
  const registry = new IntegrationProviderRegistry();
  registry.register(new MockEmailIntegrationProvider({ nowISO: NOW_ISO }));
  const service = new ConnectionService({ connectionRuntime: runtime, providerRegistry: registry, nowISO: NOW_ISO });
  const conn = service.registerRequirement({ workspaceId: WORKSPACE_ID, connectionType: "business_email", displayName: "Business Email" });
  service.attachMockCredentials({ connectionId: conn.id, providerType: "provider_mock_email" });
  const stored = runtime.getConnection(conn.id);
  assert.equal(stored.credentialReference.credentialType, "mock");
  assert.equal(stored.credentialReference.secret, undefined);
});

test("ProviderRegistry: duplicate rejection and capability lookup", () => {
  const registry = new IntegrationProviderRegistry();
  registry.register(new MockEmailIntegrationProvider({ nowISO: NOW_ISO }));
  assert.throws(() => registry.register(new MockEmailIntegrationProvider({ nowISO: NOW_ISO })));
  const smsProviders = registry.findByCapability(INTEGRATION_CAPABILITIES.SEND_SMS);
  assert.equal(smsProviders.length, 0);
  registry.register(new MockSmsIntegrationProvider({ nowISO: NOW_ISO }));
  assert.equal(registry.findByCapability(INTEGRATION_CAPABILITIES.SEND_SMS).length, 1);
});

test("ExternalActionOrchestrationService: success, blocked, idempotent", async () => {
  const runtime = new ConnectionRuntime();
  const registry = new IntegrationProviderRegistry();
  registry.register(new MockEmailIntegrationProvider({ nowISO: NOW_ISO }));
  const service = new ConnectionService({ connectionRuntime: runtime, providerRegistry: registry, nowISO: NOW_ISO });
  const credentialResolver = createMockCredentialResolver();
  const conn = service.registerRequirement({ workspaceId: WORKSPACE_ID, connectionType: "business_email", displayName: "Business Email" });

  const orchestrator = new ExternalActionOrchestrationService({
    connectionRuntime: runtime,
    providerRegistry: registry,
    credentialResolver,
    nowISO: NOW_ISO,
  });

  const blocked = await orchestrator.execute(
    createExternalActionRequest({
      id: "action_blocked",
      workspaceId: WORKSPACE_ID,
      capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
      connectionId: conn.id,
      idempotencyKey: "blocked_key",
    }),
  );
  assert.equal(blocked.status, EXTERNAL_ACTION_STATUSES.BLOCKED);

  service.attachMockCredentials({ connectionId: conn.id, providerType: "provider_mock_email" });
  await service.verifyConnection({ connectionId: conn.id, credentialResolver });

  const success = await orchestrator.execute(
    createExternalActionRequest({
      id: "action_success",
      workspaceId: WORKSPACE_ID,
      capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
      connectionId: conn.id,
      idempotencyKey: "success_key",
    }),
  );
  assert.equal(success.status, EXTERNAL_ACTION_STATUSES.COMPLETED);

  const dup = await orchestrator.execute(
    createExternalActionRequest({
      id: "action_success_dup",
      workspaceId: WORKSPACE_ID,
      capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
      connectionId: conn.id,
      idempotencyKey: "success_key",
    }),
  );
  assert.equal(dup.status, EXTERNAL_ACTION_STATUSES.COMPLETED);
});

test("WebhookIngressService: valid, invalid, duplicate", () => {
  const registry = new IntegrationProviderRegistry();
  registry.register(new MockExternalSystemIntegrationProvider({ nowISO: NOW_ISO }));
  const ingress = new WebhookIngressService({ providerRegistry: registry, nowISO: NOW_ISO });

  const rejected = ingress.ingest({ providerId: "provider_mock_external", payload: { id: "evt_1" }, headers: {} });
  assert.equal(rejected.accepted, false);

  const accepted = ingress.ingest({
    providerId: "provider_mock_external",
    payload: { id: "evt_1", eventType: "record_changed", recordId: "rec_1" },
    headers: { "x-mock-token": "valid" },
  });
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.duplicate, false);

  const duplicate = ingress.ingest({
    providerId: "provider_mock_external",
    payload: { id: "evt_1", eventType: "record_changed", recordId: "rec_1" },
    headers: { "x-mock-token": "valid" },
  });
  assert.equal(duplicate.duplicate, true);
});

test("Dependency projection and employee readiness respond to verified connection", async () => {
  const installationResult = buildPmInstallationResult();
  const runtime = new ConnectionRuntime();
  const registry = new IntegrationProviderRegistry();
  registry.register(new MockEmailIntegrationProvider({ nowISO: NOW_ISO }));
  const service = new ConnectionService({ connectionRuntime: runtime, providerRegistry: registry, nowISO: NOW_ISO });
  const conn = service.registerRequirement({ workspaceId: WORKSPACE_ID, connectionType: "business_email", displayName: "Business Email" });

  let snapshot = buildConnectedSystemsSnapshot({ installationResult, connectionRuntime: runtime });
  const employee = PROPERTY_MANAGEMENT_PACKAGE.employeeDefinitions[0];
  let readiness = buildDigitalEmployeeReadiness({
    employeeDefinition: employee,
    connectedSystemsSnapshot: snapshot,
    connectionRuntime: runtime,
  });
  assert.ok(readiness.cannotCurrently.externalCapabilities.includes("SEND_EMAIL"));

  service.attachMockCredentials({ connectionId: conn.id, providerType: "provider_mock_email" });
  await service.verifyConnection({ connectionId: conn.id, credentialResolver: createMockCredentialResolver() });

  snapshot = buildConnectedSystemsSnapshot({ installationResult, connectionRuntime: runtime });
  readiness = buildDigitalEmployeeReadiness({
    employeeDefinition: employee,
    connectedSystemsSnapshot: snapshot,
    connectionRuntime: runtime,
  });
  assert.ok(!readiness.cannotCurrently.externalCapabilities.includes("SEND_EMAIL"));

  const projection = buildConnectionDependencyProjection({
    installationResult,
    connectionRuntime: runtime,
    employeeDefinitions: installationResult.employeeDefinitions,
  });
  const emailDep = projection.connections.find((c) => c.connectionType === "business_email");
  assert.ok(emailDep.isConnected);
  assert.ok(emailDep.enables.capabilities.includes("SEND_EMAIL"));
});

test("Gmail adapter integrates without becoming Core logic", async () => {
  const gmail = new GmailIntegrationAdapter({ gmailCommunicationProvider: { health: "not_configured", send: async () => { throw new Error("not configured"); } } });
  const verification = await gmail.verifyConnection({ connection: { credentialReference: null } });
  assert.equal(verification.status, "failed");
});

test("Horizon Properties: mock email activation changes readiness truthfully", async () => {
  const result = activateWorkspace({ workspaceId: "ws_horizon_integration", activation: {
    industryPackageId: "pkg_property_management",
    demoConfigurationId: "horizon_properties",
  }, nowISO: NOW_ISO });

  const emailConn = result.integrationPlatform.connectionRuntime.getConnectionByType("business_email");
  // Horizon demo wires mock business email as connected so operating loops can run.
  assert.equal(emailConn.status, CONNECTION_STATUSES.CONNECTED);
  assert.equal(emailConn.providerType, "provider_mock_email");

  const { actionOrchestrator } = result.integrationPlatform;

  const actionResult = await actionOrchestrator.execute(
    createExternalActionRequest({
      id: "pm_email_action",
      workspaceId: "ws_horizon_integration",
      capability: INTEGRATION_CAPABILITIES.SEND_EMAIL,
      connectionId: emailConn.id,
      idempotencyKey: "pm_email_once",
    }),
  );
  assert.equal(actionResult.status, EXTERNAL_ACTION_STATUSES.COMPLETED);
});

test("Universality: email, SMS, external system configs use same platform", async () => {
  const runtime = new ConnectionRuntime();
  const registry = new IntegrationProviderRegistry();
  registry.register(new MockEmailIntegrationProvider({ nowISO: NOW_ISO }));
  registry.register(new MockSmsIntegrationProvider({ nowISO: NOW_ISO }));
  registry.register(new MockExternalSystemIntegrationProvider({ nowISO: NOW_ISO }));
  const service = new ConnectionService({ connectionRuntime: runtime, providerRegistry: registry, nowISO: NOW_ISO });
  const credentialResolver = createMockCredentialResolver();
  const orchestrator = new ExternalActionOrchestrationService({ connectionRuntime: runtime, providerRegistry: registry, credentialResolver, nowISO: NOW_ISO });

  for (const [type, provider, capability] of [
    ["business_email", "provider_mock_email", INTEGRATION_CAPABILITIES.SEND_EMAIL],
    ["sms_channel", "provider_mock_sms", INTEGRATION_CAPABILITIES.SEND_SMS],
    ["property_management_system", "provider_mock_external", INTEGRATION_CAPABILITIES.READ_EXTERNAL_RECORD],
  ]) {
    const conn = service.registerRequirement({ workspaceId: WORKSPACE_ID, connectionType: type, displayName: type });
    service.attachMockCredentials({ connectionId: conn.id, providerType: provider });
    await service.verifyConnection({ connectionId: conn.id, credentialResolver });
    const result = await orchestrator.execute(
      createExternalActionRequest({ id: `action_${type}`, workspaceId: WORKSPACE_ID, capability, connectionId: conn.id, idempotencyKey: type }),
    );
    assert.equal(result.status, EXTERNAL_ACTION_STATUSES.COMPLETED);
  }
});
