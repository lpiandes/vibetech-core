import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

/**
 * Reusable digital-employee archetypes.
 * Unknown needs become capability proposals — never silent custom code.
 */
export const BUSINESS_OS_EMPLOYEE_ARCHETYPES = deepFreeze([
  { archetypeId: "coordinator", label: "Coordinator", purpose: "Coordinate intake and operating loops." },
  { archetypeId: "follow_up_specialist", label: "Follow-up specialist", purpose: "Drive relationship and operational follow-up." },
  { archetypeId: "intake_specialist", label: "Intake specialist", purpose: "Qualify and route incoming requests." },
  { archetypeId: "researcher", label: "Researcher", purpose: "Gather and summarize evidence." },
  { archetypeId: "reviewer", label: "Reviewer", purpose: "Prepare reviewable drafts and checks." },
  { archetypeId: "scheduler", label: "Scheduler", purpose: "Coordinate scheduling and availability." },
  { archetypeId: "campaign_coordinator", label: "Campaign coordinator", purpose: "Prepare governed campaigns." },
  { archetypeId: "operations_monitor", label: "Operations monitor", purpose: "Watch queues and readiness." },
  { archetypeId: "document_specialist", label: "Document specialist", purpose: "Organize knowledge and documents." },
  { archetypeId: "analyst", label: "Analyst", purpose: "Summarize performance and trends." },
]);

export function listEmployeeArchetypeIds() {
  return BUSINESS_OS_EMPLOYEE_ARCHETYPES.map((entry) => entry.archetypeId);
}

export function getEmployeeArchetype(archetypeId) {
  return BUSINESS_OS_EMPLOYEE_ARCHETYPES.find((entry) => entry.archetypeId === String(archetypeId ?? "")) ?? null;
}

export function resolveEmployeeArchetype(archetypeId) {
  const archetype = getEmployeeArchetype(archetypeId);
  if (!archetype) {
    return {
      ok: false,
      reason: "unknown_archetype",
      proposalRequired: true,
      message: `No reusable employee archetype matches "${archetypeId}".`,
    };
  }
  return { ok: true, archetype };
}
