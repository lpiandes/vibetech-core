import assert from "node:assert/strict";
import { test } from "node:test";

import { activateWorkspace, PROPERTY_MANAGEMENT_PACKAGE_ID } from "../workspace/activation/activateWorkspace.js";
import { resetHorizonDemoWorkspace } from "../integration/HorizonDemoBootstrapRegistry.js";

const NOW = "2026-07-01T00:00:00.000Z";

test("OWNER APPROVAL: bounded decision resumes automation", () => {
  resetHorizonDemoWorkspace({ workspaceId: "ws_ep24_approval" });
  const result = activateWorkspace({
    workspaceId: "ws_ep24_approval",
    nowISO: NOW,
    activation: { industryPackageId: PROPERTY_MANAGEMENT_PACKAGE_ID, demoConfigurationId: "horizon_properties" },
  });

  const pending = result.ctx.approvalRuntime.getRequests().find((a) => a.status === "PENDING");
  assert.ok(pending, "pending owner approval exists");

  const boundary = result.operationalBoundary;
  assert.ok(boundary?.processOwnerApprovalDecision);

  const beforeRuns = result.ctx.automationRuntime.getRuns().filter((r) => r.status === "WAITING_FOR_APPROVAL").length;
  boundary.processOwnerApprovalDecision({ approvalId: pending.id, decision: "GRANT" });
  const after = result.ctx.approvalRuntime.getRequestById(pending.id);
  assert.equal(after.status, "GRANTED");
  const afterWaiting = result.ctx.automationRuntime.getRuns().filter((r) => r.status === "WAITING_FOR_APPROVAL").length;
  assert.ok(afterWaiting <= beforeRuns);
});
