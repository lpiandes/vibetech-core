import assert from "node:assert/strict";
import { test } from "node:test";

import { mergePlanAdditions, parseOwnerPlanAdditions } from "./parseOwnerPlanAdditions.js";

test("parses practice plan as workspace and workout plan builder as teammate", () => {
  const parsed = parseOwnerPlanAdditions("practice plan and workout plan builder");
  assert.equal(parsed.modules.length, 1);
  assert.match(parsed.modules[0].label, /Practice Plan/i);
  assert.equal(parsed.employees.length, 1);
  assert.match(parsed.employees[0].label, /Workout Plan Builder/i);
});

test("sentence add requests become one AI teammate", () => {
  const parsed = parseOwnerPlanAdditions(
    "generate practice plan and workout plans daily for all age groups",
  );
  assert.equal(parsed.modules.length, 0);
  assert.equal(parsed.employees.length, 1);
  assert.match(parsed.employees[0].label, /Practice & Workout Plan Builder/i);
  assert.match(parsed.employees[0].purpose, /all age groups/i);
});

test("mergePlanAdditions dedupes by id", () => {
  const first = parseOwnerPlanAdditions("practice plan");
  const second = parseOwnerPlanAdditions("practice plan and intake specialist");
  const merged = mergePlanAdditions(first, second);
  assert.equal(merged.modules.length, 1);
  assert.equal(merged.employees.length, 1);
});
