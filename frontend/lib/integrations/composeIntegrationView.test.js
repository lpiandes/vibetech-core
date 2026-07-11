import assert from "node:assert/strict";
import { test } from "node:test";

import { composeIntegrationView } from "./composeIntegrationView.js";
import { IntegrationHubEngine } from "../../../backend/core/integrations/hub/IntegrationHubEngine.js";

test("composeIntegrationView projects hub model for portal workspace", () => {
  const recommended = new IntegrationHubEngine().recommendIntegrations({
    businessSummary: { industry: "dental", integrations: ["Gmail"] },
    businessId: "biz_dental",
  });
  const view = composeIntegrationView({
    integrationModel: recommended.integrationModel,
    businessOsMapping: recommended.businessOsMapping,
  });
  assert.equal(view.hasIntegrations, true);
  assert.ok(view.connections.length >= 3);
  assert.ok(view.metrics.some((entry) => entry.id === "connections"));
});

test("composeIntegrationView falls back to requirements", () => {
  const view = composeIntegrationView({
    configuration: {
      integrations: {
        integrationRequirements: [
          { requirementId: "req_gmail", providerId: "gmail", label: "Gmail", status: "needs_setup", capabilities: ["send_email"] },
        ],
      },
    },
    businessOsMapping: {
      integrationRequirements: [
        { requirementId: "req_gmail", providerId: "gmail", label: "Gmail", status: "needs_setup", capabilities: ["send_email"] },
      ],
      capabilityRequirements: [
        { capabilityId: "send_email", label: "Send Email", satisfiedBy: ["gmail"] },
      ],
    },
  });
  assert.equal(view.hasIntegrations, true);
  assert.equal(view.connections[0].providerId, "gmail");
});
