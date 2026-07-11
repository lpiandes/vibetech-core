import assert from "node:assert/strict";
import { test } from "node:test";

import { BuilderChangeProposalService } from "./BuilderChangeProposalService.js";
import { BuilderAssemblyPlanner } from "./BuilderAssemblyPlanner.js";
import { BuilderSpecificationAssembler } from "./BuilderSpecificationAssembler.js";
import { createBuilderSession } from "./BuilderSession.js";

test("conversational change produces preview, diff, and approval requirements", async () => {
  const session = createBuilderSession({
    businessSummary: { businessName: "Bright Smile", industry: "dental" },
  });
  const plan = new BuilderAssemblyPlanner().plan({ session });
  const { specification } = new BuilderSpecificationAssembler().assemble({ session, assemblyPlan: plan });
  const service = new BuilderChangeProposalService();
  const result = await service.propose({
    session,
    specification,
    text: "Rename Patients to Clients",
  });
  assert.equal(result.ok, true);
  assert.equal(result.requiresDryRun, true);
  assert.equal(result.requiresApproval, true);
  assert.ok(result.impact.affectedAreas.includes("terminology") || result.impact.affectedAreas.includes("modules"));
  assert.ok(result.preview.views.navigation);
});
