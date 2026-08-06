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
import { getIntegrationDisplay, isIntegrationListed } from "./integrationDisplay.ts";

const liveFlags = {
  business_email: true,
  business_email_oauth: true,
  calendar: true,
  sms_channel: true,
  voice_channel: true,
  social_screening: true,
  meta_lead_ads: true,
  property_management: true,
};

const presentation = {
  statusLabels: {
    CONNECTED: "Connected",
    NOT_CONNECTED: "Not connected",
  },
  liveFlags,
  connectionLabels: {
    business_email: {
      title: "Business email",
      purpose: "Send prospect acknowledgments and follow-up communication",
      tier: "live",
      setupMode: "oauth",
    },
    property_management_system: {
      title: "Property management software",
      purpose: "Sync properties, residents, leases, and work orders",
      tier: "live",
      setupMode: "manual",
    },
    sms_channel: { title: "Text messaging", tier: "live", setupMode: "api_key" },
    accounting: { title: "Accounting", tier: "live" },
  },
};

const connections = [
  { id: "business_email", requirementLevel: "required", status: "CONNECTED" },
  { id: "property_management_system", requirementLevel: "recommended", status: "NOT_CONNECTED" },
  { id: "sms_channel", requirementLevel: "optional", status: "NOT_CONNECTED" },
  { id: "accounting", requirementLevel: "optional", status: "NOT_CONNECTED" },
];

test("unavailable integrations are not listed", () => {
  assert.equal(isIntegrationListed("accounting", liveFlags), false);
  assert.equal(isIntegrationListed("sms_channel", liveFlags), true);
  assert.equal(isIntegrationListed("business_email", liveFlags), true);
});

test("integration metrics ignore unlisted connections", () => {
  const metrics = deriveIntegrationMetrics(connections, presentation);
  assert.equal(metrics.connected, 1);
  assert.equal(metrics.required, 1);
  // accounting filtered out; sms + pms remain optional
  assert.equal(metrics.optionalOrSoon, 2);
});

test("business email oauth exposes Connect with Google", () => {
  const display = mergeIntegrationDisplay(
    "business_email",
    "Business email",
    getIntegrationDisplay("business_email", undefined, liveFlags),
    presentation,
  );
  const action = primaryIntegrationAction(
    { id: "business_email", status: "NOT_CONNECTED", requirementLevel: "required" },
    display,
  );
  assert.deepEqual(action, { kind: "connect", label: "Connect with Google" });
  assert.equal(hasRealConnectAction({ id: "business_email", status: "NOT_CONNECTED" }, display), true);
});

test("connected email offers prove it works", () => {
  const display = mergeIntegrationDisplay(
    "business_email",
    "Business email",
    getIntegrationDisplay("business_email", undefined, liveFlags),
    presentation,
  );
  const action = primaryIntegrationAction(
    { id: "business_email", status: "CONNECTED", requirementLevel: "required" },
    display,
  );
  assert.equal(action?.kind, "prove");
  assert.equal(action?.proveAction, "send_test_email");
});

test("website forms offer prove without Connected", () => {
  const display = getIntegrationDisplay("website_forms");
  const action = primaryIntegrationAction(
    { id: "website_forms", status: "NOT_CONNECTED", requirementLevel: "optional" },
    display,
  );
  assert.equal(action?.kind, "prove");
  assert.equal(action?.proveAction, "submit_test_form");
  assert.equal(action?.capabilityId, "website_forms");
});

test("hubspot connected offers CRM prove", () => {
  const display = getIntegrationDisplay("hubspot");
  const action = primaryIntegrationAction(
    { id: "hubspot", status: "CONNECTED", requirementLevel: "optional" },
    display,
  );
  assert.equal(action?.kind, "prove");
  assert.equal(action?.proveAction, "sync_test_crm_contact");
});

test("partition sections never build a roadmap of unavailable channels", () => {
  const sections = partitionIntegrationSections(
    connections,
    (conn) =>
      mergeIntegrationDisplay(
        String(conn.id),
        conn.displayName,
        getIntegrationDisplay(String(conn.id), conn.displayName, liveFlags),
        presentation,
      ),
    liveFlags,
  );

  assert.equal(sections.roadmap.length, 0);
  // Connected required integrations leave Required and appear only under Connected.
  assert.equal(sections.required.length, 0);
  assert.equal(sections.connected.length, 1);
  assert.ok(sections.available.some((item) => item.display.id === "sms_channel"));
  assert.ok(!sections.available.some((item) => item.display.id === "accounting"));
});

test("business email connected state renders human label", () => {
  const status = connectionStatusPresentation("CONNECTED", presentation);
  assert.equal(status.label, "Connected");
  assert.equal(status.tone, "success");
});
