import { listEmployeeArchetypeIds } from "../business-os/BusinessOSEmployeeArchetypes.js";

/** Legacy / thin-SKU aliases that must map onto registered employee archetypes. */
const ARCHETYPE_ALIASES = Object.freeze({
  receptionist_coordinator: "intake_specialist",
  intake_coordinator: "intake_specialist",
  sales_outreach: "follow_up_specialist",
});

function isOwnerDefinedEmployeeArchetype(archetypeId) {
  return /^owner_defined_[a-z0-9_-]+$/i.test(String(archetypeId ?? ""));
}

/**
 * Rewrite unknown employee archetype ids so dry-run validation does not fail
 * on older sessions that were assembled before archetype ids were corrected.
 */
export function sanitizeSpecificationEmployeeArchetypes(specification) {
  if (!specification || typeof specification !== "object") return specification;
  const known = new Set(listEmployeeArchetypeIds());
  const employees = Array.isArray(specification.employeeDefinitions)
    ? specification.employeeDefinitions
    : null;
  if (!employees?.length) return specification;

  let changed = false;
  const next = employees.map((employee) => {
    const raw = String(employee?.archetypeId ?? "").trim();
    if (!raw) return employee;
    if (known.has(raw) || isOwnerDefinedEmployeeArchetype(raw)) return employee;
    const mapped = ARCHETYPE_ALIASES[raw] ?? "coordinator";
    changed = true;
    return { ...employee, archetypeId: mapped };
  });

  if (!changed) return specification;
  return { ...specification, employeeDefinitions: next };
}
