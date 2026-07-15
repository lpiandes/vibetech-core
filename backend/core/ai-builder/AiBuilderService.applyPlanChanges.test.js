import assert from "node:assert/strict";
import { test } from "node:test";

import { AiBuilderService } from "./AiBuilderService.js";
import { BuilderSessionRepository } from "./BuilderSessionRepository.js";
import { createBuilderSession } from "./BuilderSession.js";

test("applyPlanChanges adds owner teammate onto the visual proposal", async () => {
  const repo = new BuilderSessionRepository();
  const service = new AiBuilderService({ repository: repo });
  const sessionId = "abs_plan_change_test";

  await repo.save(createBuilderSession({
    sessionId,
    currentStage: "proposal_ready",
    businessSummary: { businessName: "new biz", industry: "fitness" },
  }));

  service.proposals.set(sessionId, {
    specification: {
      specificationId: "spec_1",
      contentHash: "h1",
      businessId: "b1",
      businessProfile: { businessName: "new biz", industry: "fitness" },
      modules: [
        { moduleId: "home", label: "Home" },
        { moduleId: "work", label: "Work" },
      ],
      navigation: {},
      employeeDefinitions: [
        { employeeId: "scheduler", label: "Scheduler", purpose: "Coordinate scheduling" },
      ],
      workflowDefinitions: [],
      roleDefinitions: [],
      integrationRequirements: [],
      campaignDefinitions: [],
    },
    assemblyPlan: null,
    dryRunChecklist: null,
  });

  const result = await service.applyPlanChanges({
    sessionId,
    addRequest: "create workout and practice plans daily",
  });

  assert.equal(result.ok, true);
  assert.equal(result.session.appearance.planAdditions.employees.length, 1);
  assert.match(result.session.appearance.planAdditions.employees[0].label, /Practice & Workout/i);

  const workforce = result.proposal?.views?.digitalWorkforce?.items ?? [];
  const added = workforce.filter((item) => item.ownerAdded);
  assert.equal(added.length, 1);
  assert.match(added[0].label, /Practice & Workout Plan Builder/i);
  assert.ok(workforce.some((item) => item.label === "Scheduler"));
});
