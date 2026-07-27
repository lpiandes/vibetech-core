import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveOperatingContractSchema } from "./OperatingContractSchemas.js";
import {
  applyOperatingContractPatch,
  buildOperatingContract,
  ensureEmployeeOperatingContract,
  validateOperatingContractCompleteness,
} from "./buildOperatingContract.js";

test("sports club intake resolves sports schema not dental", () => {
  const schema = resolveOperatingContractSchema({
    employee: { roleId: "club_intake", label: "Club Intake Coordinator" },
    industry: "sports",
  });
  assert.equal(schema.schemaId, "sports_club_intake");
  assert.ok(schema.scopeFields.some((f) => f.key === "audience"));
});

test("family comms and dental recall stay separate", () => {
  const family = resolveOperatingContractSchema({
    employee: { roleId: "family_comms", label: "Family Communications Coordinator" },
    industry: "sports",
  });
  const recall = resolveOperatingContractSchema({
    employee: { roleId: "dental_recall", label: "Recall Coordinator" },
    industry: "dental",
  });
  assert.equal(family.schemaId, "sports_family_comms");
  assert.equal(recall.schemaId, "dental_recall");
});

test("buildOperatingContract marks required scope missing until answered", () => {
  const { contract, completeness, schema } = buildOperatingContract({
    employee: {
      employeeId: "emp_pack_sports_club_intake",
      roleId: "club_intake",
      label: "Club Intake Coordinator",
    },
    industry: "sports",
  });
  assert.equal(contract.schemaId, "sports_club_intake");
  assert.equal(completeness.complete, false);
  assert.ok(completeness.missingKeys.includes("audience"));
  assert.ok(schema.scopeFields.length >= 4);
});

test("discovery summary seeds audience/when answers", () => {
  const { contract, completeness } = buildOperatingContract({
    employee: { roleId: "practice_plan", label: "Practice Plan Assistant" },
    industry: "sports",
    discoverySummary: {
      teamsAndPrograms: "U12 and U14 travel",
      scheduleCoordination: "Plans due 24h before practice",
    },
  });
  assert.match(String(contract.scope.answers.audience.value), /U12/);
  assert.match(String(contract.scope.answers.when.value), /24h/);
  assert.equal(completeness.missingKeys.includes("audience"), false);
});

test("applyOperatingContractPatch can complete required scope", () => {
  const employee = {
    employeeId: "emp_1",
    roleId: "family_comms",
    label: "Family Communications Coordinator",
  };
  const patched = applyOperatingContractPatch({
    employee,
    industry: "sports",
    actorId: "owner_1",
    nowISO: "2026-07-20T00:00:00.000Z",
    patch: {
      scope: {
        answers: {
          audience: "All travel families",
          when: "Within 2 hours of schedule changes",
          where: "Email",
          howMany: "Max 3/week",
          constraints: "Owner approves every send",
        },
      },
    },
  });
  assert.equal(patched.completeness.complete, true);
  assert.equal(patched.contract.updatedBy, "owner_1");
});

test("ensureEmployeeOperatingContract adds automation stub", () => {
  const next = ensureEmployeeOperatingContract({
    employeeId: "emp_pack_sports_family_comms",
    roleId: "family_comms",
    label: "Family Communications Coordinator",
  }, { industry: "sports" });
  assert.ok(next.operatingContract);
  assert.ok(Array.isArray(next.automationDefinitions));
  assert.ok(next.automationDefinitions.some((a) => String(a.automationId).includes("auto_contract_")));
});

test("N/A with reason counts as complete for a required field", () => {
  const schema = resolveOperatingContractSchema({
    employee: { roleId: "club_intake" },
    industry: "sports",
  });
  const completeness = validateOperatingContractCompleteness({
    scope: {
      answers: {
        audience: { notApplicable: true, reason: "Intake handled by humans only" },
        when: "N/A never",
        where: "Email",
        constraints: "Always escalate",
      },
    },
  }, schema);
  // when is a string without being N/A object - still truthy
  assert.equal(completeness.missingKeys.includes("audience"), false);
});
