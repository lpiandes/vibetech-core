import test from "node:test";
import assert from "node:assert/strict";

import { sanitizeSpecificationEmployeeArchetypes } from "./sanitizeSpecificationEmployeeArchetypes.js";

test("sanitizer remaps legacy receptionist archetype", () => {
  const next = sanitizeSpecificationEmployeeArchetypes({
    employeeDefinitions: [
      { employeeId: "e1", label: "Front Desk", archetypeId: "receptionist_coordinator" },
      { employeeId: "e2", label: "Intake", archetypeId: "intake_specialist" },
    ],
  });
  assert.equal(next.employeeDefinitions[0].archetypeId, "intake_specialist");
  assert.equal(next.employeeDefinitions[1].archetypeId, "intake_specialist");
});
