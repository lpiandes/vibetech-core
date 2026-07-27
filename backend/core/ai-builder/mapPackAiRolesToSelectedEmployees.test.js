import assert from "node:assert/strict";
import { test } from "node:test";

import {
  mapPackAiRolesToEmployees,
  mergePackAndOwnerEmployeeRecommendations,
  mergePackEmployeesIntoList,
  packEmployeesForIndustry,
} from "./mapPackAiRolesToSelectedEmployees.js";
import { BuilderAssemblyPlanner } from "./BuilderAssemblyPlanner.js";
import { BuilderSpecificationAssembler } from "./BuilderSpecificationAssembler.js";
import { createBuilderSession } from "./BuilderSession.js";

test("maps sports pack aiRoles to archetypes", () => {
  const matched = packEmployeesForIndustry("sports");
  assert.equal(matched.length, 4);
  assert.ok(matched.some((e) => e.label === "Club Intake Coordinator" && e.archetypeId === "intake_specialist"));
  assert.ok(matched.some((e) => e.label === "Practice Plan Assistant" && e.archetypeId === "document_specialist"));
  assert.ok(matched.some((e) => e.label === "Family Communications Coordinator" && e.archetypeId === "communications_specialist"));
  assert.ok(matched.some((e) => e.label === "Calendar Reminder"));
});

test("maps dental pack aiRoles to archetypes", () => {
  const matched = packEmployeesForIndustry("dental");
  assert.equal(matched.length, 2);
  assert.equal(matched[0].label, "Dental Intake Coordinator");
  assert.equal(matched[1].archetypeId, "follow_up_specialist");
  assert.ok(!matched.some((e) => /club|player|family/i.test(e.label)));
});

test("sports and dental pack workforces never overlap", () => {
  const sports = packEmployeesForIndustry("sports");
  const dental = packEmployeesForIndustry("dental");
  const sportsLabels = new Set(sports.map((e) => e.label));
  const dentalLabels = new Set(dental.map((e) => e.label));
  for (const label of sportsLabels) assert.equal(dentalLabels.has(label), false);
  const sportsIds = mergePackEmployeesIntoList([], "sports").employees.map((e) => e.employeeId);
  const dentalIds = mergePackEmployeesIntoList([], "dental").employees.map((e) => e.employeeId);
  assert.ok(sportsIds.every((id) => id.startsWith("emp_pack_sports_")));
  assert.ok(dentalIds.every((id) => id.startsWith("emp_pack_dental_")));
});

test("legacy string aiRoles still map via label fallback", () => {
  const matched = mapPackAiRolesToEmployees([
    "Dental Intake Coordinator",
    "Recall Coordinator",
  ]);
  assert.equal(matched.length, 2);
  assert.equal(matched[1].archetypeId, "follow_up_specialist");
});

test("assembly planner always installs sports pack workforce", () => {
  const session = createBuilderSession({
    businessSummary: {
      businessName: "Top Gun Hockey Club",
      industry: "sports",
    },
  });
  const plan = new BuilderAssemblyPlanner().plan({ session });
  assert.ok(plan.selectedEmployees.length >= 3);
  const labels = plan.selectedEmployees.map((e) => e.label);
  assert.ok(labels.includes("Club Intake Coordinator"));
  assert.ok(labels.includes("Practice Plan Assistant"));
  assert.ok(labels.includes("Family Communications Coordinator"));
  assert.ok(plan.assumptions.some((a) => a.assumptionId === "assume_pack_workforce"));
});

test("sports assembly produces employeeDefinitions from pack defaults", () => {
  const planner = new BuilderAssemblyPlanner();
  const assembler = new BuilderSpecificationAssembler();
  const session = createBuilderSession({
    businessSummary: { businessName: "Northline", industry: "sports" },
  });
  const plan = planner.plan({ session });
  const assembled = assembler.assemble({ session, assemblyPlan: plan });
  assert.equal(assembled.source, "rec_bp_sports_club");
  assert.ok(assembled.specification.modules.some((m) => m.moduleId === "teams"));
  assert.ok(assembled.specification.employeeDefinitions.length >= 3);
  assert.ok(
    assembled.specification.employeeDefinitions.some((e) => e.label === "Club Intake Coordinator"),
  );
});

test("owner extras merge onto pack defaults without dropping pack roles", () => {
  const recs = mergePackAndOwnerEmployeeRecommendations({
    industry: "sports",
    ownerRequested: [{
      archetypeId: "ai_caller",
      label: "Voice Call Assistant",
      purpose: "Calls",
    }],
  });
  assert.ok(recs.length >= 4);
  assert.ok(recs.some((e) => e.label === "Club Intake Coordinator"));
  assert.ok(recs.some((e) => e.label === "Voice Call Assistant"));
});

test("heal merges missing pack employees into empty list", () => {
  const { employees, added } = mergePackEmployeesIntoList([], "sports");
  assert.equal(added, 4);
  assert.equal(employees.length, 4);
  assert.ok(employees.every((e) => e.operatingContract?.version === 1));
  assert.ok(employees.every((e) => Array.isArray(e.automationDefinitions) && e.automationDefinitions.length > 0));
  const again = mergePackEmployeesIntoList(employees, "sports");
  assert.equal(again.added, 0);
  assert.equal(again.employees.length, 4);
});

test("resolves sports industry from hockey business name without industry field", async () => {
  const { resolveOperatingIndustry } = await import("./OperatingPackRegistry.js");
  assert.equal(
    resolveOperatingIndustry({ businessName: "Top Gun Hockey Club" }),
    "sports",
  );
  assert.equal(
    resolveOperatingIndustry({ industry: "", businessName: "Bright Smile Dental" }),
    "dental",
  );
});
