import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WorkRuntime } from "../../work/WorkRuntime.js";
import { CustomAiWorkerService } from "./CustomAiWorkerService.js";
import { compileCustomAiEmployee } from "./CustomAiWorkerCompiler.js";

const USA_HOCKEY_FIXTURE = `
Practice Plans from USA Hockey ADM.
Warm-up: Dynamic skating edges with open-hip strides.
Skill Station: Technique under time in two lanes.
Small-area Games: Cross-ice 3v3 with short shifts.
Cool-down: Easy movement plus 3-question debrief.
`;

describe("CustomAiWorkerService", () => {
  it("creates reviewable work with cited practice-plan artifact from authority pack", async () => {
    const workRuntime = new WorkRuntime({ nowISO: "2026-07-01T00:00:00.000Z" });
    const employee = compileCustomAiEmployee({
      employeeId: "owner_emp_workout",
      label: "Practice & Workout Plan Builder",
      purpose: "Build youth hockey workout plans",
    }, { ownerAdded: true });

    const worker = new CustomAiWorkerService({
      nowISO: () => "2026-07-01T12:00:00.000Z",
      packFixtures: {
        "https://www.usahockey.com/practiceplans": USA_HOCKEY_FIXTURE,
      },
    });
    const result = await worker.runJob({
      workRuntime,
      employee,
      brief: "Build Friday hockey practice plan for U14",
      businessId: "biz_1",
    });

    assert.equal(result.ok, true);
    const item = workRuntime.getWorkItem(result.workItemId);
    assert.ok(item);
    assert.equal(item.status, "ready");
    assert.equal(item.assignedTo, "owner_emp_workout");
    assert.equal(item.workType, "custom_ai_task");
    assert.equal(item.metadata?.artifact?.kind, "specialty_deliverable");
    assert.equal(item.metadata?.artifact?.templateId, "session_flow");
    assert.equal(item.metadata?.artifact?.diagram?.layout, "timeline");
    assert.match(String(item.metadata?.artifact?.title ?? ""), /Friday|U14/i);
    assert.equal(item.metadata?.outboundRequiresApproval, true);
    assert.ok(Array.isArray(item.metadata?.sourceRefs) && item.metadata.sourceRefs.length >= 1);
    assert.equal(item.metadata.sourceRefs[0].org, "USA Hockey");
    assert.match(String(result.workHref), /workId=/);
    const activities = item.metadata.artifact.diagram.nodes.flatMap((node) => node.activities ?? []);
    assert.ok(activities.length >= 1);
    assert.ok(activities.every((activity) => (activity.citations ?? []).length > 0));
  });

  it("can run repeatedly with a frozen workspace clock and records source gaps when unmatched", async () => {
    const workRuntime = new WorkRuntime({ nowISO: "2026-07-01T00:00:00.000Z" });
    const employee = compileCustomAiEmployee({
      employeeId: "owner_emp_workout",
      label: "Practice & Workout Plan Builder",
      purpose: "create daily workout and practice plans",
    }, { ownerAdded: true });
    const worker = new CustomAiWorkerService({ nowISO: () => "2026-07-01T00:00:00.000Z" });

    const first = await worker.runJob({
      workRuntime,
      employee,
      brief: "Build Friday practice plan for U14",
      businessId: "biz_1",
    });
    const second = await worker.runJob({
      workRuntime,
      employee,
      brief: "Build Friday practice plan for U14",
      businessId: "biz_1",
    });

    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.notEqual(first.workItemId, second.workItemId);
    assert.equal(second.artifact?.diagram?.layout, "timeline");
    assert.ok(Array.isArray(second.sourceRefs));
    assert.ok(second.artifact?.gaps?.length);
  });
});
