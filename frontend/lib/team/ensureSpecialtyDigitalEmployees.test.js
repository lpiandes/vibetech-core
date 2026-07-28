import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureSpecialtyDigitalEmployees } from "./ensureSpecialtyDigitalEmployees.js";

test("injects missing owner-added employees onto the Team roster", () => {
  const next = ensureSpecialtyDigitalEmployees({
    businessId: "biz_1",
    knowledgeCount: 1,
    digitalEmployees: [{ id: "emp_pkg", employeeId: "emp_pkg", name: "Package Coach" }],
    bosEmployees: [
      { employeeId: "emp_pkg", label: "Package Coach" },
      {
        employeeId: "owner_emp_workout",
        label: "Practice & Workout Plan Builder",
        ownerAdded: true,
        purpose: "Build workout plans for coaches from club knowledge",
        approvalRequirements: ["human_approval"],
        communicationPermissions: { customerFacingRequiresApproval: true },
      },
    ],
  });

  assert.equal(next.length, 2);
  const owner = next.find((entry) => entry.employeeId === "owner_emp_workout");
  assert.ok(owner);
  assert.equal(owner.name, "Practice & Workout Plan Builder");
  assert.equal(owner.specialtyHref, "/b/biz_1/specialty/owner_emp_workout");
  assert.equal(owner.askHref, "/b/biz_1/specialty/owner_emp_workout");
  assert.equal(owner.ownerAdded, true);
  assert.equal(owner.isReady, false);
  assert.match(String(owner.statusLabel), /Ready/);
});

test("injects pack-default AI teammates even when not owner-added", () => {
  const next = ensureSpecialtyDigitalEmployees({
    businessId: "biz_hockey",
    digitalEmployees: [],
    bosEmployees: [
      {
        employeeId: "emp_pack_club_intake",
        label: "Club Intake Coordinator",
        purpose: "Qualify inquiries",
        packDefault: true,
        archetypeId: "intake_specialist",
      },
      {
        employeeId: "emp_pack_family_comms",
        label: "Family Communications Coordinator",
        purpose: "Family messages",
        packDefault: true,
        archetypeId: "communications_specialist",
      },
      {
        employeeId: "emp_pack_practice_plan",
        label: "Practice Plan Assistant",
        purpose: "Practice plans",
        packDefault: true,
        archetypeId: "document_specialist",
      },
    ],
  });

  assert.equal(next.length, 3);
  assert.ok(next.every((entry) => entry.packDefault === true));
  assert.ok(next.some((entry) => entry.name === "Club Intake Coordinator"));
});

test("patches existing roster rows missing specialtyHref", () => {
  const next = ensureSpecialtyDigitalEmployees({
    businessId: "biz_1",
    digitalEmployees: [
      { id: "emp_pack_front", employeeId: "emp_pack_front", name: "Front Desk", packDefault: true },
    ],
    bosEmployees: [
      { employeeId: "emp_pack_front", label: "Front Desk", packDefault: true },
    ],
  });
  assert.equal(next.length, 1);
  assert.equal(next[0].specialtyHref, "/b/biz_1/specialty/emp_pack_front");
  assert.equal(next[0].detailHref, "/b/biz_1/specialty/emp_pack_front");
});
