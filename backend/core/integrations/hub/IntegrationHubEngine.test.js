import assert from "node:assert/strict";
import { test } from "node:test";

import { IntegrationHubEngine } from "./IntegrationHubEngine.js";
import { mapIntegrationsToBusinessOS } from "./mapIntegrationsToBusinessOS.js";
import {
  getProvider,
  listProviderIds,
  listProvidersByCapability,
  resolveIntegrationTemplate,
} from "./ProviderCatalog.js";
import { createAuthFlowPlan, assertSafeCredentialReference } from "./AuthFlowAbstraction.js";
import { HUB_HEALTH_STATUSES, resolveHubHealthStatus } from "./HealthStatusModel.js";
import { IntegrationRecommendationEngine } from "../../ai-builder/IntegrationRecommendationEngine.js";
import { IntegrationGenerationStage } from "../../architect/ArchitectMatchingStages.js";
import { CONNECTION_STATUSES } from "../connections/ConnectionStatus.js";

test("provider registration covers required categories", () => {
  const ids = listProviderIds();
  for (const id of [
    "gmail", "outlook", "microsoft_365", "google_workspace", "twilio", "slack", "microsoft_teams", "zoom",
    "google_calendar", "outlook_calendar", "microsoft_calendar",
    "quickbooks_online", "xero", "stripe", "square",
    "hubspot", "salesforce", "shopify", "woocommerce",
    "google_drive", "onedrive", "dropbox", "calendly",
    "rest_api", "webhook", "oauth2_generic", "api_key_generic",
  ]) {
    assert.ok(ids.includes(id), id);
    assert.ok(getProvider(id));
  }
});

test("capability mapping resolves providers by capability", () => {
  const email = listProvidersByCapability("send_email");
  assert.ok(email.some((entry) => entry.providerId === "gmail"));
  const payments = listProvidersByCapability("payments");
  assert.ok(payments.some((entry) => entry.providerId === "stripe"));
  const engine = new IntegrationHubEngine();
  assert.ok(engine.resolveProvidersForCapability("calendar_read").length >= 1);
});

test("OAuth flow abstraction never exposes secrets", () => {
  const plan = createAuthFlowPlan({ providerId: "gmail", businessId: "biz_1" });
  assert.equal(plan.ok, true);
  assert.equal(plan.authMethod, "oauth2");
  assert.equal(plan.supportsRefresh, true);
  assert.equal(plan.secretsExposed, false);
  assert.equal(plan.credentialReferenceShape.secret, undefined);
  assert.ok(plan.steps.some((step) => step.kind === "oauth_authorize"));
});

test("API key providers use key flow without leaking secrets", () => {
  const plan = createAuthFlowPlan({ providerId: "stripe" });
  assert.equal(plan.authMethod, "api_key");
  assert.ok(plan.steps.some((step) => step.kind === "api_key_input"));
  const unsafe = assertSafeCredentialReference({ apiKey: "sk_live_xxx" });
  assert.equal(unsafe.ok, false);
  const safe = assertSafeCredentialReference({ credentialId: "cred_1", providerId: "stripe" });
  assert.equal(safe.ok, true);
});

test("health monitoring exposes hub statuses", () => {
  assert.ok(HUB_HEALTH_STATUSES.connected);
  assert.ok(HUB_HEALTH_STATUSES.needs_attention);
  assert.ok(HUB_HEALTH_STATUSES.syncing);
  assert.ok(HUB_HEALTH_STATUSES.paused);
  assert.ok(HUB_HEALTH_STATUSES.deprecated);
  const connected = resolveHubHealthStatus({
    status: CONNECTION_STATUSES.CONNECTED,
    lastVerifiedAt: "2026-07-11T00:00:00.000Z",
    id: "c1",
  });
  assert.equal(connected.statusId, "connected");
  const syncing = resolveHubHealthStatus(null, { hubFlags: { syncing: true } });
  assert.equal(syncing.statusId, "syncing");
});

test("retry disconnect reconnect lifecycle", () => {
  const engine = new IntegrationHubEngine();
  const connected = engine.connect({
    providerId: "gmail",
    businessId: "biz_a",
    credentialReference: { credentialId: "cred_g", providerId: "gmail" },
  });
  assert.equal(connected.ok, true);
  assert.equal(connected.connection.health.statusId, "connected");
  assert.equal(connected.connection.secretsExposed, false);

  const disconnected = engine.disconnect({ connection: connected.connection });
  assert.equal(disconnected.connection.health.statusId, "disconnected");

  const reconnected = engine.reconnect({ connection: disconnected.connection, businessId: "biz_a" });
  assert.equal(reconnected.ok, true);

  const retried = engine.retry({
    connection: {
      ...connected.connection,
      health: { statusId: "error" },
      errorHistory: [{ at: "2026-07-11T00:00:00.000Z", message: "timeout" }],
    },
  });
  assert.equal(retried.ok, true);
  assert.ok(retried.attempts.length >= 1);

  const testResult = engine.testConnection({ connection: connected.connection });
  assert.equal(testResult.ok, true);
});

test("Architect recommendations include reason confidence evidence alternatives benefits", () => {
  const result = new IntegrationHubEngine().recommendIntegrations({
    businessSummary: { industry: "dental", integrations: ["Gmail", "Stripe"] },
    businessId: "biz_dental",
  });
  assert.ok(result.integrations.length >= 3);
  assert.ok(result.integrationModel.detectedSoftware.some((entry) => entry.providerId === "gmail"));
  for (const recommendation of result.recommendations) {
    assert.ok(recommendation.reason || recommendation.why);
    assert.equal(typeof recommendation.confidence, "number");
    assert.ok(Array.isArray(recommendation.evidence));
    assert.ok(Array.isArray(recommendation.alternatives));
  }
  assert.ok(result.integrations.every((entry) => Array.isArray(entry.benefits)));
});

test("planned growth channels stay selectable but cannot look connected", () => {
  const result = new IntegrationHubEngine().recommendIntegrations({
    businessSummary: { industry: "dental" },
    businessId: "biz_dental",
  });

  for (const providerId of ["google_ads", "google_search_console", "meta_ads"]) {
    const recommendation = result.recommendations.find((entry) => entry.payload?.provider?.providerId === providerId);
    assert.ok(recommendation, providerId);
    assert.equal(recommendation.selected, false, providerId);
    assert.equal(recommendation.payload.provider.status, "planned", providerId);
    assert.match(recommendation.reason, /not live until/i, providerId);
  }
});

test("capability resolution prefers capabilities over provider-specific logic", () => {
  const result = new IntegrationHubEngine().recommendIntegrations({
    businessSummary: { industry: "default" },
  });
  assert.ok(result.recommendations.some((entry) => entry.kind === "capability"));
  assert.ok(result.businessOsMapping.capabilityRequirements.length >= 1);
});

test("multi-business isolation on model and mapping", () => {
  const a = new IntegrationHubEngine().recommendIntegrations({
    businessSummary: { industry: "default" },
    businessId: "biz_a",
  });
  const b = new IntegrationHubEngine().recommendIntegrations({
    businessSummary: { industry: "default" },
    businessId: "biz_b",
  });
  assert.equal(a.integrationModel.tenantIsolation.businessId, "biz_a");
  assert.equal(b.businessOsMapping.tenantIsolation.businessId, "biz_b");
  assert.notEqual(a.integrationModel.tenantIsolation.businessId, b.integrationModel.tenantIsolation.businessId);
});

test("role permission checks differ by membership", () => {
  const result = new IntegrationHubEngine().recommendIntegrations({
    businessSummary: { industry: "sports" },
  });
  assert.equal(result.integrationModel.permissions.OWNER.canConnect, true);
  assert.equal(result.integrationModel.permissions.VIEWER.canConnect, false);
  assert.equal(result.integrationModel.permissions.EMPLOYEE.canViewLogs, false);
});

test("mapIntegrationsToBusinessOS fills readiness fields", () => {
  const result = new IntegrationHubEngine().recommendIntegrations({
    businessSummary: { industry: "property_management" },
  });
  const mapped = mapIntegrationsToBusinessOS(result.integrationModel);
  assert.ok(mapped.integrationRequirements.length >= 1);
  assert.ok(mapped.connectedSystemDefinitions.length >= 1);
  assert.equal(mapped.tenantIsolation.noCrossTenantCredentials, true);
});

test("multi-industry templates differ without vertical engines", () => {
  const pm = resolveIntegrationTemplate("property_management");
  const dental = resolveIntegrationTemplate("dental");
  assert.ok(pm.recommendedProviderIds.includes("quickbooks_online"));
  assert.ok(dental.recommendedProviderIds.includes("stripe"));
});

test("IntegrationRecommendationEngine facade preserves integration recommendations", () => {
  const facade = new IntegrationRecommendationEngine();
  const result = facade.recommend({ businessSummary: { industry: "default" } });
  assert.equal(result.ok, true);
  assert.ok(result.recommendations.every((entry) => entry.kind === "integration"));
  assert.ok(result.integrationModel.connections.length >= 2);
});

test("Architect integration_generation stage outputs integration model", () => {
  const stage = new IntegrationGenerationStage();
  const result = stage.generate({
    dna: {
      company: { industry: "sports" },
      integrations: [{ label: "Slack" }, { label: "Gmail" }],
    },
    businessId: "biz_hockey",
  });
  assert.equal(result.stageId, "integration_generation");
  assert.ok(result.outputs.integrations.length >= 1);
  assert.ok(result.outputs.integrationModel.connections.length >= 1);
  assert.ok(result.outputs.businessOsMapping.integrationRequirements.length >= 1);
});
