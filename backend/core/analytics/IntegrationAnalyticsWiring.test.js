import assert from "node:assert/strict";
import { test } from "node:test";

import { AnalyticsRuntime } from "./AnalyticsRuntime.js";
import { PlatformEventBus } from "../events/bus/PlatformEventBus.js";
import { PlatformEventStore } from "../events/PlatformEventStore.js";
import { createAnalyticsEventSubscriber } from "./subscribers/AnalyticsEventSubscriber.js";
import { wireIntegrationLifecycleAnalytics } from "./subscribers/wireIntegrationLifecycleAnalytics.js";
import { IntegrationPlatformEventPublisher } from "../integrations/events/IntegrationPlatformEventPublisher.js";
import { ConnectionRuntime } from "../integrations/connections/ConnectionRuntime.js";
import { IntegrationProviderRegistry } from "../integrations/providers/IntegrationProviderRegistry.js";
import { MockEmailIntegrationProvider } from "../integrations/fixtures/MockEmailIntegrationProvider.js";
import { ConnectionService } from "../integrations/use-cases/ConnectionService.js";
import { createMockCredentialResolver } from "../integrations/credentials/MockCredentialResolver.js";
import { INTEGRATION_ANALYTICS_EVENTS } from "./subscribers/wireIntegrationLifecycleAnalytics.js";

const NOW_ISO = "2026-07-01T00:00:00.000Z";
const WORKSPACE_ID = "ws_analytics_integration";

test("Integration lifecycle events record analytics data points", async () => {
  const store = new PlatformEventStore({ nowISO: NOW_ISO });
  const bus = new PlatformEventBus({ nowISO: NOW_ISO });
  const analyticsRuntime = new AnalyticsRuntime({ seed: null, nowISO: NOW_ISO });
  const analyticsSubscriber = createAnalyticsEventSubscriber({
    id: "sub_analytics_integration",
    analyticsRuntime,
    supportedEvents: INTEGRATION_ANALYTICS_EVENTS,
  });
  wireIntegrationLifecycleAnalytics({ bus, analyticsSubscriber });

  const publisher = new IntegrationPlatformEventPublisher({ platformEventBus: bus, platformEventStore: store, nowISO: NOW_ISO });
  const connectionRuntime = new ConnectionRuntime();
  const registry = new IntegrationProviderRegistry();
  registry.register(new MockEmailIntegrationProvider({ nowISO: NOW_ISO }));
  const connectionService = new ConnectionService({
    connectionRuntime,
    providerRegistry: registry,
    integrationPlatformEventPublisher: publisher,
    nowISO: NOW_ISO,
  });

  const conn = connectionService.registerRequirement({
    workspaceId: WORKSPACE_ID,
    connectionType: "business_email",
    displayName: "Business Email",
  });
  connectionService.attachMockCredentials({ connectionId: conn.id, providerType: "provider_mock_email" });
  await connectionService.verifyConnection({ connectionId: conn.id, credentialResolver: createMockCredentialResolver() });

  const metrics = analyticsRuntime.getMetrics?.() ?? [];
  const metricIds = metrics.map((m) => m.id);
  assert.ok(metricIds.includes("connection_connected_count"));
  assert.ok(metricIds.includes("connection_verified_count"));

  const dataPoints = analyticsRuntime.getDataPoints?.() ?? [];
  assert.ok(dataPoints.length >= 2);
});

test("AnalyticsEventMapper supports integration event dimensions", async () => {
  const { mapPlatformEventToAnalyticsDataPoint } = await import("./subscribers/AnalyticsEventMapper.js");
  const mapped = mapPlatformEventToAnalyticsDataPoint({
    eventId: "evt_test",
    eventType: "CONNECTION_VERIFIED",
    occurredAt: NOW_ISO,
    payload: { connectionType: "business_email", providerType: "provider_mock_email" },
  });
  assert.equal(mapped?.metricId, "connection_verified_count");
});
