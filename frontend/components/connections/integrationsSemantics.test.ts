import assert from "node:assert/strict";
import { test } from "node:test";

import {
  connectionStatusPresentation,
  deriveIntegrationMetrics,
  hasRealConnectAction,
  mergeIntegrationDisplay,
  partitionIntegrationSections,
  primaryIntegrationAction,
} from "./integrationsSemantics.ts";
import { getIntegrationDisplay } from "./integrationDisplay.ts";

const presentation = {
  statusLabels: {
    CONNECTED: "Connected",
    NOT_CONNECTED: "Not connected",
  },
  connectionLabels: {
    business_email: {
      title: "Business email",
      purpose: "Send prospect acknowledgments and follow-up communication",
      tier: "primary",
      setupMode: "dev_connect",
    },
    property_management_system: {
      title: "Property management software",
      purpose: "Sync properties, residents, leases, and work orders",
      tier: "primary",
      setupMode: "manual",
    },
    sms_channel: { title: "Text messaging", tier: "coming_soon" },
  },
};

const connections = [
  { id: "business_email", requirementLevel: "required", status: "CONNECTED" },
  { id: "property_management_system", requirementLevel: "recommended", status: "NOT_CONNECTED" },
  { id: "sms_channel", requirementLevel: "optional", status: "NOT_CONNECTED" },
];

test("integration metrics match real connection state", () => {
  const metrics = deriveIntegrationMetrics(connections, presentation);
  assert.equal(metrics.connected, 1);
  assert.equal(metrics.required, 1);
  assert.equal(metrics.needsSetup, 0);
  assert.equal(metrics.optionalOrSoon, 2);
  assert.deepEqual(
    metrics.metrics.map((metric) => metric.value),
    ["1", "0", "1", "2"],
  );
});

test("business email connected state renders human label", () => {
  const status = connectionStatusPresentation("CONNECTED", presentation);
  assert.equal(status.label, "Connected");
  assert.equal(status.tone, "success");
});

test("unsupported integrations do not expose fake connect actions", () => {
  const pmsDisplay = mergeIntegrationDisplay(
    "property_management_system",
    "Property Management System",
    getIntegrationDisplay("property_management_system"),
    presentation,
  );
  const smsDisplay = mergeIntegrationDisplay("sms_channel", "SMS", getIntegrationDisplay("sms_channel"), presentation);
  const pmsConn = connections[1];
  const smsConn = connections[2];

  assert.deepEqual(primaryIntegrationAction(pmsConn, pmsDisplay), { kind: "manual", label: "We'll set this up with you" });
  assert.equal(primaryIntegrationAction(smsConn, smsDisplay), null);
  assert.equal(hasRealConnectAction(pmsConn, pmsDisplay), false);
});

test("partition sections and labels avoid raw connection enums", () => {
  const sections = partitionIntegrationSections(connections, (conn) =>
    mergeIntegrationDisplay(String(conn.id), conn.displayName, getIntegrationDisplay(String(conn.id), conn.displayName), presentation),
  );

  assert.equal(sections.required.length, 1);
  assert.equal(sections.connected.length, 1);
  assert.equal(sections.available.length, 2);
  assert.ok(sections.required[0].display.title === "Business email");
  assert.ok(sections.available.some((item) => item.display.title === "Text messaging"));
  assert.ok(!JSON.stringify(sections.required).includes("NOT_CONNECTED"));
});
