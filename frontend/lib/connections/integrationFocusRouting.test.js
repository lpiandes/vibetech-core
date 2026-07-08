import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPathWithoutFocus,
  shouldOpenIntegrationFromFocus,
} from "./integrationFocusRouting.js";

const propertySoftware = {
  id: "property_management_system",
  title: "Property management software",
};

const primary = [
  {
    conn: { id: "property_management_system", status: "NOT_CONNECTED" },
    display: propertySoftware,
  },
  {
    conn: { id: "business_email", status: "CONNECTED" },
    display: { id: "business_email", title: "Business email" },
  },
];

test("focus deep link opens property software modal when not connected", () => {
  const display = shouldOpenIntegrationFromFocus({
    focus: "property_management_system",
    setupTarget: null,
    consumedFocus: null,
    primary,
    isConnected: (status) => String(status).toUpperCase() === "CONNECTED",
  });
  assert.equal(display?.id, "property_management_system");
});

test("consumed focus does not reopen modal after close while URL still has focus", () => {
  const display = shouldOpenIntegrationFromFocus({
    focus: "property_management_system",
    setupTarget: null,
    consumedFocus: "property_management_system",
    primary,
    isConnected: (status) => String(status).toUpperCase() === "CONNECTED",
  });
  assert.equal(display, null);
});

test("open modal blocks duplicate focus open while setupTarget is set", () => {
  const display = shouldOpenIntegrationFromFocus({
    focus: "property_management_system",
    setupTarget: propertySoftware,
    consumedFocus: null,
    primary,
    isConnected: (status) => String(status).toUpperCase() === "CONNECTED",
  });
  assert.equal(display, null);
});

test("buildPathWithoutFocus removes only focus and preserves other query params", () => {
  const params = new URLSearchParams("focus=property_management_system&tab=overview");
  assert.equal(
    buildPathWithoutFocus("/b/ws/integrations", params),
    "/b/ws/integrations?tab=overview",
  );
});

test("buildPathWithoutFocus returns pathname when focus was the only query param", () => {
  const params = new URLSearchParams("focus=property_management_system");
  assert.equal(buildPathWithoutFocus("/b/ws/integrations", params), "/b/ws/integrations");
});

test("buildPathWithoutFocus is unchanged when focus is absent", () => {
  const params = new URLSearchParams("tab=overview");
  assert.equal(buildPathWithoutFocus("/b/ws/integrations", params), "/b/ws/integrations");
});
