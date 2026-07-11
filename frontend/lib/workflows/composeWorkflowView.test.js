import assert from "node:assert/strict";
import { test } from "node:test";

import { composeWorkflowView } from "./composeWorkflowView.js";
import { WorkflowEngine } from "../../../backend/core/workflows/WorkflowEngine.js";

test("composeWorkflowView projects workflow model for portal workspace", () => {
  const recommended = new WorkflowEngine().recommendWorkflows({
    businessSummary: { industry: "dental" },
    businessId: "biz_dental",
  });
  const view = composeWorkflowView({
    workflowModel: recommended.workflowModel,
    businessOsMapping: recommended.businessOsMapping,
  });
  assert.equal(view.hasWorkflows, true);
  assert.ok(view.workflows.length >= 3);
  assert.ok(view.automations.length >= 1);
  assert.ok(view.metrics.some((entry) => entry.id === "workflows"));
});

test("composeWorkflowView falls back to workflowDefinitions", () => {
  const view = composeWorkflowView({
    configuration: {
      workflowDefinitions: [
        { workflowId: "patient_intake", label: "Patient intake", stageCount: 3, approvalRequired: true },
      ],
    },
  });
  assert.equal(view.hasWorkflows, true);
  assert.equal(view.workflows[0].id, "patient_intake");
  assert.ok(view.pendingApprovals.length >= 1);
});
