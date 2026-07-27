import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCustomAiReadyChecklist,
  resolvePackTeammatePublicStatus,
} from "./buildCustomAiReadyChecklist.js";
import { applyOperatingContractPatch } from "../operating-contract/buildOperatingContract.js";

test("custom AI ready checklist requires operating contract scope", () => {
  const employee = {
    employeeId: "owner_emp_1",
    label: "Parent Communications Assistant",
    purpose: "Owner-requested AI teammate for family messages.",
    ownerAdded: true,
    approvalRequirements: ["human_approval"],
    communicationPermissions: { customerFacingRequiresApproval: true },
  };
  const incomplete = buildCustomAiReadyChecklist(employee, {
    knowledgeCount: 1,
    hasRunProve: true,
  });
  assert.equal(incomplete.ready, false);
  assert.ok(incomplete.items.some((i) => i.id === "operating_contract" && !i.complete));

  const patched = applyOperatingContractPatch({
    employee: { ...employee, roleId: "family_comms" },
    industry: "sports",
    patch: {
      scope: {
        answers: {
          audience: "All families",
          when: "On schedule changes",
          where: "Email",
          howMany: "3/week",
          constraints: "Always approve",
        },
      },
    },
  });
  const complete = buildCustomAiReadyChecklist({
    ...employee,
    roleId: "family_comms",
    operatingContract: patched.contract,
  }, { knowledgeCount: 1, hasRunProve: true });
  assert.equal(complete.ready, true);
});

test("pack teammate status reflects missing scope keys", () => {
  const status = resolvePackTeammatePublicStatus({
    employeeId: "emp_pack_sports_club_intake",
    roleId: "club_intake",
    label: "Club Intake Coordinator",
    readinessState: "needs_knowledge",
  });
  assert.equal(status.isReady, false);
  assert.match(status.statusLabel, /Needs setup/);
});
